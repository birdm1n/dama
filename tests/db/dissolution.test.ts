import { describe, it, expect } from "vitest";
import { withTx, expectDbError } from "./helpers";

describe("연결 해제", () => {
  it("한쪽이 해제하면 두 사람 모두 활성 커플에서 빠지고 30일 보관 상태가 된다", () =>
    withTx(async (db) => {
      const [a, b] = await db.createUsers("Ana", "Ben");
      const x = await db.pair(a, b, "X");

      const [{ purge_after }] = await db.as<{ purge_after: Date }>(a, "select leave_couple() as purge_after");
      const days = (new Date(purge_after).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThanOrEqual(30.01);

      const [c] = await db.admin<{ status: string }>("select status from couples where id = $1", [x]);
      expect(c.status).toBe("dissolved");

      for (const u of [a, b]) {
        // 해제된 커플은 보관 기간 동안 읽기만 가능 (상태 확인·내보내기 안내용)
        const rows = await db.as<{ status: string }>(u, "select status from couples");
        expect(rows).toEqual([{ status: "dissolved" }]);
        // 더 이상 상대 프로필은 보이지 않는다
        const profiles = await db.as<{ display_name: string }>(u, "select display_name from profiles");
        expect(profiles).toEqual([{ display_name: u.name }]);
        // 상대의 멤버십 행도 보이지 않는다 (내 행만)
        const members = await db.as<{ user_id: string }>(u, "select user_id from couple_members");
        expect(members.map((m) => m.user_id)).toEqual([u.id]);
        // 보관 중인 커플을 수정할 수 없다
        expect(await db.as(u, "update couples set name = 'z' returning id")).toHaveLength(0);
        // 초대도 만들 수 없다
        await expectDbError(db.createInvite(u), "NOT_IN_COUPLE");
      }
    }));

  it("해제 후에는 각자 새 커플을 만들 수 있고, 예전 초대 링크는 쓸 수 없다", () =>
    withTx(async (db) => {
      const [a, b, c] = await db.createUsers("Ana", "Ben", "Cy");
      await db.createCouple(a);
      const pending = await db.createInvite(a);
      await db.as(a, "select leave_couple()");
      await expectDbError(db.acceptInvite(c, pending.token), "INVITE_REVOKED");

      const x2 = await db.pair(a, c);
      const y2 = await db.createCouple(b);
      expect(x2).not.toBe(y2);
    }));

  it("커플이 없는 사람은 해제할 수 없다", () =>
    withTx(async (db) => {
      const a = await db.createUser("Ana");
      await expectDbError(db.as(a, "select leave_couple()"), "NOT_IN_COUPLE");
    }));

  it("보관 기간이 지나면 커플 데이터가 영구 삭제되고, 그 전에는 남아 있다", () =>
    withTx(async (db) => {
      const [a, b, c, d] = await db.createUsers("Ana", "Ben", "Cy", "Di");
      const x = await db.pair(a, b);
      const y = await db.pair(c, d);
      await db.as(a, "select leave_couple()");
      await db.as(c, "select leave_couple()");
      // X만 보관 기간 만료로 만든다
      await db.admin("update couples set purge_after = now() - interval '1 second' where id = $1", [x]);

      // 만료된 커플은 purge 전이라도 RLS상 더 이상 보이지 않는다
      expect(await db.as(a, "select id from couples")).toHaveLength(0);

      const [{ n }] = await db.admin<{ n: number }>("select private.purge_dissolved_couples() as n");
      expect(n).toBe(1);
      expect(await db.admin("select 1 from couples where id = $1", [x])).toHaveLength(0);
      expect(await db.admin("select 1 from couple_members where couple_id = $1", [x])).toHaveLength(0);
      expect(await db.admin("select 1 from couple_invites where couple_id = $1", [x])).toHaveLength(0);
      expect(await db.admin("select 1 from couples where id = $1", [y])).toHaveLength(1);
    }));
});
