import { describe, it, expect } from "vitest";
import { withTx, expectDbError, createPost, type Db, type TestUser } from "./helpers";

async function setup(db: Db) {
  await db.admin("delete from public_posts");
  const [a, c, d, e, m] = await db.createUsers("Ana", "Cy", "Di", "Eve", "Mod");
  const mod: TestUser = { ...m, admin: true };
  const id = await createPost(db, a, { title: "신고된 글" });
  return { a, c, d, e, mod, id };
}
const report = (db: Db, u: TestUser, id: string, reason = "spam", detail: string | null = null) =>
  db.as(u, "insert into post_reports (post_id, reporter_id, reason, detail) values ($1, $2, $3, $4)", [id, u.id, reason, detail]);

describe("신고 검토", () => {
  it("운영자가 아니면 대기열·처리 함수를 쓸 수 없고, 다른 사람의 신고 내용도 못 본다", () =>
    withTx(async (db) => {
      const { a, c, d, id } = await setup(db);
      await report(db, c, id);
      await expectDbError(db.as(d, "select * from admin_report_queue()"), "NOT_ADMIN");
      await expectDbError(db.as(a, "select moderate_post($1, 'restore')", [id]), "NOT_ADMIN");
      expect(await db.as(d, "select * from post_reports")).toEqual([]);
      // app_metadata는 사용자가 스스로 바꿀 수 없다 (JWT를 위조하지 않는 한 claims는 서버가 정한다)
    }));

  it("운영자는 대기열에서 신고 사유·내용을 보고, 검토 대기 글도 본다", () =>
    withTx(async (db) => {
      const { c, d, e, mod, id } = await setup(db);
      await report(db, c, id, "spam");
      await report(db, d, id, "privacy", "제 얼굴이 나와요");
      await report(db, e, id, "spam");
      const [q] = await db.as<{ title: string; status: string; open_reports: string; reasons: string[]; details: string[] }>(
        mod, "select * from admin_report_queue()",
      );
      expect(q).toMatchObject({ title: "신고된 글", status: "under_review", open_reports: "3", details: ["제 얼굴이 나와요"] });
      expect(q.reasons.sort()).toEqual(["privacy", "spam"]);
      expect(await db.as(mod, "select title from public_posts where id = $1", [id])).toEqual([{ title: "신고된 글" }]);
      expect(await db.as(mod, "select count(*)::int as n from post_reports")).toEqual([{ n: 3 }]);
    }));

  it("복구: 다시 공개되고 신고는 기각, 기록이 남는다", () =>
    withTx(async (db) => {
      const { c, d, e, mod, id } = await setup(db);
      for (const u of [c, d, e]) await report(db, u, id);
      await db.as(mod, "select moderate_post($1, 'restore', '문제 없음')", [id]);
      expect(await db.as(c, "select title from public_posts where id = $1", [id])).toHaveLength(1);
      expect(await db.as(c, "select status from post_reports")).toEqual([{ status: "dismissed" }]);
      expect(await db.as(mod, "select * from admin_report_queue()")).toEqual([]);
      const log = await db.admin<{ decision: string; note: string }>("select decision, note from private.moderation_log where post_id = $1", [id]);
      expect(log).toEqual([{ decision: "restore", note: "문제 없음" }]);
    }));

  it("내리기: 다른 사람에겐 사라지고, 작성자는 보지만 다시 공개할 수 없다(삭제는 가능)", () =>
    withTx(async (db) => {
      const { a, c, mod, id } = await setup(db);
      await report(db, c, id);
      await db.as(mod, "select moderate_post($1, 'remove')", [id]);
      expect(await db.as(c, "select * from public_posts where id = $1", [id])).toEqual([]);
      expect(await db.as(a, "select status from public_posts where id = $1", [id])).toEqual([{ status: "removed" }]);
      expect(await db.as(a, "update public_posts set status = 'published' where id = $1 returning id", [id])).toEqual([]);
      expect(await db.as(a, "update public_posts set title = 'x' where id = $1 returning id", [id])).toEqual([]);
      expect(await db.as(a, "delete from public_posts where id = $1 returning id", [id])).toHaveLength(1);
    }));

  it("작성자가 직접 숨긴 글은 운영자도 볼 수 없고 처리할 수 없다", () =>
    withTx(async (db) => {
      const { a, mod, id } = await setup(db);
      await db.as(a, "update public_posts set status = 'hidden' where id = $1", [id]);
      expect(await db.as(mod, "select * from public_posts where id = $1", [id])).toEqual([]);
      await expectDbError(db.as(mod, "select moderate_post($1, 'restore')", [id]), "POST_NOT_FOUND");
    }));

  it("운영자도 신고·글을 직접 수정할 수는 없다(처리는 함수로만)", () =>
    withTx(async (db) => {
      const { c, mod, id } = await setup(db);
      await report(db, c, id);
      await expectDbError(db.as(mod, "update post_reports set status = 'dismissed'"), "permission denied");
      expect(await db.as(mod, "update public_posts set status = 'removed' where id = $1 returning id", [id])).toEqual([]);
    }));
});
