import { describe, it, expect } from "vitest";
import { withTx, expectDbError, type Db, type TestUser } from "./helpers";

/**
 * 완료 기준: 다른 커플의 데이터에 접근할 수 없음을 DB 레벨에서 검증한다.
 * 커플 X = (A, B), 커플 Y = (C, D), 아직 커플이 없는 E.
 */
async function setup(db: Db) {
  const [a, b, c, d, e] = await db.createUsers("Ana", "Ben", "Cy", "Di", "Eve");
  const x = await db.pair(a, b, "X");
  const y = await db.pair(c, d, "Y");
  // Y 커플에는 취소된 초대 이력도 하나 만들어 둔다
  return { a, b, c, d, e, x, y };
}

const TABLES = ["couples", "couple_members", "couple_invites", "profiles"] as const;

describe("RLS: 커플 간 데이터 격리", () => {
  it("각 사용자는 자기 커플의 행만 본다", () =>
    withTx(async (db) => {
      const { a, c, e, x, y } = await setup(db);

      const see = async (u: TestUser) => ({
        couples: (await db.as<{ id: string }>(u, "select id from couples")).map((r) => r.id),
        members: (await db.as<{ couple_id: string }>(u, "select distinct couple_id from couple_members")).map(
          (r) => r.couple_id,
        ),
        invites: (await db.as<{ couple_id: string }>(u, "select distinct couple_id from couple_invites")).map(
          (r) => r.couple_id,
        ),
        profiles: (await db.as<{ display_name: string }>(u, "select display_name from profiles order by 1")).map(
          (r) => r.display_name,
        ),
      });

      expect(await see(a)).toEqual({ couples: [x], members: [x], invites: [x], profiles: ["Ana", "Ben"] });
      expect(await see(c)).toEqual({ couples: [y], members: [y], invites: [y], profiles: ["Cy", "Di"] });
      expect(await see(e)).toEqual({ couples: [], members: [], invites: [], profiles: ["Eve"] });
    }));

  it("다른 커플의 id를 알아도 직접 조회할 수 없다", () =>
    withTx(async (db) => {
      const { a, c, y } = await setup(db);
      expect(await db.as(a, "select * from couples where id = $1", [y])).toHaveLength(0);
      expect(await db.as(a, "select * from couple_members where couple_id = $1", [y])).toHaveLength(0);
      expect(await db.as(a, "select id from couple_invites where couple_id = $1", [y])).toHaveLength(0);
      expect(await db.as(a, "select * from profiles where id = $1", [c.id])).toHaveLength(0);
    }));

  it("다른 커플의 데이터를 수정할 수 없다 (0행 처리)", () =>
    withTx(async (db) => {
      const { a, c, y } = await setup(db);
      const upd = await db.as(a, "update couples set name = 'hacked' where id = $1 returning id", [y]);
      expect(upd).toHaveLength(0);
      const upd2 = await db.as(a, "update profiles set display_name = 'hacked' where id = $1 returning id", [c.id]);
      expect(upd2).toHaveLength(0);
      const [row] = await db.admin<{ name: string }>("select name from couples where id = $1", [y]);
      expect(row.name).toBe("Y");
      const [p] = await db.admin<{ display_name: string }>("select display_name from profiles where id = $1", [c.id]);
      expect(p.display_name).toBe("Cy");
    }));

  it("상대의 프로필도 수정할 수 없다 (같은 커플이어도 본인만)", () =>
    withTx(async (db) => {
      const { a, b } = await setup(db);
      const upd = await db.as(a, "update profiles set display_name = 'x' where id = $1 returning id", [b.id]);
      expect(upd).toHaveLength(0);
      const mine = await db.as(a, "update profiles set display_name = 'Ana2' where id = $1 returning id", [a.id]);
      expect(mine).toHaveLength(1);
    }));

  it("테이블에 직접 INSERT/DELETE 하여 RPC 검증을 우회할 수 없다", () =>
    withTx(async (db) => {
      const { a, e, y } = await setup(db);
      // 다른 커플에 자기 자신을 끼워 넣기
      await expectDbError(
        db.as(e, "insert into couple_members (couple_id, user_id) values ($1, $2)", [y, e.id]),
        "permission denied",
      );
      await expectDbError(db.as(e, "insert into couples (name) values ('mine')"), "permission denied");
      await expectDbError(
        db.as(e, "insert into couple_invites (couple_id, token_hash, expires_at) values ($1, '\\x00', now() + interval '1 day')", [y]),
        "permission denied",
      );
      await expectDbError(db.as(a, "delete from couples where id = $1", [y]), "permission denied");
      await expectDbError(db.as(a, "delete from couple_members"), "permission denied");
      // 상태 컬럼을 직접 바꿔 해제·복구 흉내 내기 불가
      await expectDbError(db.as(a, "update couples set status = 'dissolved'"), "permission denied");
      await expectDbError(db.as(a, "update couple_members set left_at = now()"), "permission denied");
      await expectDbError(db.as(a, "update profiles set id = gen_random_uuid()"), "permission denied");
    }));

  it("다른 커플의 초대를 취소할 수 없다", () =>
    withTx(async (db) => {
      const [a, c] = await db.createUsers("Ana", "Cy");
      await db.createCouple(a);
      await db.createCouple(c);
      await db.createInvite(c);
      const [inv] = await db.admin<{ id: string }>(
        "select i.id from couple_invites i join couple_members m on m.couple_id = i.couple_id where m.user_id = $1",
        [c.id],
      );
      await expectDbError(db.as(a, "select revoke_invite($1)", [inv.id]), "INVITE_INVALID");
      const [row] = await db.admin<{ revoked_at: Date | null }>("select revoked_at from couple_invites where id = $1", [inv.id]);
      expect(row.revoked_at).toBeNull();
    }));

  it("anon은 어떤 테이블도 읽을 수 없다", () =>
    withTx(async (db) => {
      await setup(db);
      for (const t of TABLES) {
        await expectDbError(db.as("anon", `select * from ${t}`), "permission denied");
      }
    }));

  it("private 헬퍼는 anon이 실행할 수 없고, 보관 데이터 삭제 함수는 일반 사용자도 실행할 수 없다", () =>
    withTx(async (db) => {
      const { a } = await setup(db);
      await expectDbError(db.as("anon", "select private.my_active_couple_id()"), "permission denied");
      await expectDbError(db.as(a, "select private.purge_dissolved_couples()"), "permission denied");
    }));

  it("모든 public 테이블에 RLS가 켜져 있다 (새 테이블 추가 시 누락 방지)", () =>
    withTx(async (db) => {
      const rows = await db.admin<{ relname: string }>(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
      );
      expect(rows).toEqual([]);
    }));
});
