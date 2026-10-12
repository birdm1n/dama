import { describe, it, expect } from "vitest";
import { withTx, expectDbError } from "./helpers";

describe("커플 연결 (초대 → 수락)", () => {
  it("가입하면 프로필이 생성된다", () =>
    withTx(async (db) => {
      const a = await db.createUser("Ana");
      const rows = await db.as<{ display_name: string }>(a, "select display_name from profiles");
      expect(rows).toEqual([{ display_name: "Ana" }]);
    }));

  it("두 계정이 초대 링크로 실제 커플로 연결된다", () =>
    withTx(async (db) => {
      const a = await db.createUser("Ana");
      const b = await db.createUser("Ben");

      const coupleId = await db.createCouple(a, "우리");
      const { token, expires_at } = await db.createInvite(a);
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const hours = (new Date(expires_at).getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(23.9);
      expect(hours).toBeLessThanOrEqual(24.01);

      // 수락 전, B는 커플을 볼 수 없다
      expect(await db.as(b, "select id from couples")).toHaveLength(0);

      const preview = await db.as(b, "select * from get_invite_preview($1)", [token]);
      expect(preview[0]).toMatchObject({ inviter_name: "Ana", couple_name: "우리", status: "valid" });

      expect(await db.acceptInvite(b, token)).toBe(coupleId);

      for (const user of [a, b]) {
        const members = await db.as<{ user_id: string }>(
          user,
          "select user_id from couple_members where couple_id = $1 and left_at is null order by joined_at",
          [coupleId],
        );
        expect(members.map((m) => m.user_id).sort()).toEqual([a.id, b.id].sort());
        const profiles = await db.as<{ display_name: string }>(
          user,
          "select display_name from profiles order by display_name",
        );
        expect(profiles.map((p) => p.display_name)).toEqual(["Ana", "Ben"]);
      }

      const [invite] = await db.admin<{ used_by: string; used_at: Date | null }>(
        "select used_by, used_at from couple_invites where couple_id = $1",
        [coupleId],
      );
      expect(invite.used_by).toBe(b.id);
      expect(invite.used_at).not.toBeNull();
    }));

  it("토큰 원문은 DB에 저장되지 않고, 해시 컬럼은 클라이언트가 읽을 수 없다", () =>
    withTx(async (db) => {
      const a = await db.createUser("Ana");
      await db.createCouple(a);
      const { token } = await db.createInvite(a);

      const dump = await db.admin<{ t: string }>("select row_to_json(i)::text as t from couple_invites i");
      expect(dump[0].t).not.toContain(token);

      await expectDbError(db.as(a, "select token_hash from couple_invites"), "permission denied");
      const visible = await db.as(a, "select id, expires_at from couple_invites");
      expect(visible).toHaveLength(1);
    }));

  it("만료된 초대는 거부된다", () =>
    withTx(async (db) => {
      const a = await db.createUser("Ana");
      const b = await db.createUser("Ben");
      await db.createCouple(a);
      const { token } = await db.createInvite(a);
      await db.admin(
        "update couple_invites set created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'",
      );
      const [p] = await db.as(b, "select status, inviter_name from get_invite_preview($1)", [token]);
      expect(p).toEqual({ status: "expired", inviter_name: null });
      await expectDbError(db.acceptInvite(b, token), "INVITE_EXPIRED");
    }));

  it("이미 사용한 초대는 다시 쓸 수 없다", () =>
    withTx(async (db) => {
      const [a, b, c] = await db.createUsers("Ana", "Ben", "Cy");
      await db.createCouple(a);
      const { token } = await db.createInvite(a);
      await db.acceptInvite(b, token);
      await expectDbError(db.acceptInvite(c, token), "INVITE_USED");
    }));

  it("새 초대를 발급하면 이전 초대는 자동 취소된다", () =>
    withTx(async (db) => {
      const a = await db.createUser("Ana");
      const b = await db.createUser("Ben");
      await db.createCouple(a);
      const first = await db.createInvite(a);
      const second = await db.createInvite(a);
      await expectDbError(db.acceptInvite(b, first.token), "INVITE_REVOKED");
      await db.acceptInvite(b, second.token);
    }));

  it("초대를 직접 취소할 수 있다", () =>
    withTx(async (db) => {
      const a = await db.createUser("Ana");
      const b = await db.createUser("Ben");
      await db.createCouple(a);
      const { token } = await db.createInvite(a);
      const [inv] = await db.as<{ id: string }>(a, "select id from couple_invites");
      await db.as(a, "select revoke_invite($1)", [inv.id]);
      await expectDbError(db.acceptInvite(b, token), "INVITE_REVOKED");
    }));

  it("잘못된 토큰, 자기 초대 수락은 거부된다", () =>
    withTx(async (db) => {
      const a = await db.createUser("Ana");
      const b = await db.createUser("Ben");
      await db.createCouple(a);
      const { token } = await db.createInvite(a);
      await expectDbError(db.acceptInvite(b, "not-a-real-token"), "INVITE_INVALID");
      await expectDbError(db.acceptInvite(b, ""), "INVITE_INVALID");
      await expectDbError(db.acceptInvite(a, token), "INVITE_OWN");
    }));

  it("이미 다른 커플에 속한 사람은 수락할 수 없다", () =>
    withTx(async (db) => {
      const [a, b, c, d] = await db.createUsers("Ana", "Ben", "Cy", "Di");
      await db.pair(c, d);
      await db.createCouple(a);
      const { token } = await db.createInvite(a);
      await expectDbError(db.acceptInvite(c, token), "ALREADY_IN_COUPLE");
      // 한 사람이 커플을 두 개 만들 수도 없다
      await expectDbError(db.createCouple(c), "ALREADY_IN_COUPLE");
      void b;
    }));

  it("커플은 최대 2명: 꽉 찬 커플은 초대를 발급할 수 없다", () =>
    withTx(async (db) => {
      const [a, b] = await db.createUsers("Ana", "Ben");
      await db.pair(a, b);
      await expectDbError(db.createInvite(a), "COUPLE_FULL");
      await expectDbError(db.createInvite(b), "COUPLE_FULL");
    }));

  it("정원 트리거: 어떤 경로로든 3번째 활성 멤버는 추가되지 않는다", () =>
    withTx(async (db) => {
      const [a, b, c] = await db.createUsers("Ana", "Ben", "Cy");
      const coupleId = await db.pair(a, b);
      await expectDbError(
        db.admin("insert into couple_members (couple_id, user_id) values ($1, $2)", [coupleId, c.id]),
        "COUPLE_FULL",
      );
    }));

  it("커플이 없는 사람은 초대를 만들 수 없다", () =>
    withTx(async (db) => {
      const a = await db.createUser("Ana");
      await expectDbError(db.createInvite(a), "NOT_IN_COUPLE");
    }));

  it("로그인하지 않은 사용자(anon)는 RPC를 호출할 수 없다", () =>
    withTx(async (db) => {
      const a = await db.createUser("Ana");
      await db.createCouple(a);
      const { token } = await db.createInvite(a);
      await expectDbError(db.as("anon", "select create_couple()"), "permission denied");
      await expectDbError(db.as("anon", "select accept_invite($1)", [token]), "permission denied");
      await expectDbError(db.as("anon", "select * from get_invite_preview($1)", [token]), "permission denied");
    }));
});
