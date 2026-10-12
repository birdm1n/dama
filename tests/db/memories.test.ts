import { describe, it, expect } from "vitest";
import { withTx, expectDbError, writeMemory, titlesSeenBy, type Db } from "./helpers";

async function setup(db: Db) {
  const [a, b, c, d, e] = await db.createUsers("Ana", "Ben", "Cy", "Di", "Eve");
  const x = await db.pair(a, b, "X");
  const y = await db.pair(c, d, "Y");
  const ids = {
    aDraft: await writeMemory(db, a, x, { title: "A-초안", tags: ["비밀"] }),
    aShared: await writeMemory(db, a, x, { title: "A-공유", tags: ["카페"], share: "shared" }),
    bDraft: await writeMemory(db, b, x, { title: "B-초안" }),
    bShared: await writeMemory(db, b, x, { title: "B-공유", share: "shared" }),
    cShared: await writeMemory(db, c, y, { title: "C-공유", share: "shared" }),
  };
  return { a, b, c, d, e, x, y, ids };
}

describe("기록: 공유 규칙과 커플 격리", () => {
  it("초안은 작성자만, 공유 기록은 커플 둘 다 본다", () =>
    withTx(async (db) => {
      const { a, b } = await setup(db);
      expect(await titlesSeenBy(db, a)).toEqual(["A-공유", "A-초안", "B-공유"]);
      expect(await titlesSeenBy(db, b)).toEqual(["A-공유", "B-공유", "B-초안"]);
    }));

  it("다른 커플·커플 없는 사용자·anon은 기록을 전혀 볼 수 없다", () =>
    withTx(async (db) => {
      const { c, d, e, ids } = await setup(db);
      expect(await titlesSeenBy(db, c)).toEqual(["C-공유"]);
      expect(await titlesSeenBy(db, d)).toEqual(["C-공유"]);
      expect(await titlesSeenBy(db, e)).toEqual([]);
      expect(await db.as(c, "select id from memories where id = $1", [ids.aShared])).toHaveLength(0);
      await expectDbError(db.as("anon", "select * from memories"), "permission denied");
    }));

  it("초안의 태그 이름도 상대에게 보이지 않는다", () =>
    withTx(async (db) => {
      const { a, b } = await setup(db);
      const tagsB = await db.as<{ tag: string }>(b, "select tag from my_memory_tags()");
      expect(tagsB.map((t) => t.tag)).toEqual(["카페"]);
      const tagsA = await db.as<{ tag: string }>(a, "select tag from my_memory_tags() order by tag");
      expect(tagsA.map((t) => t.tag)).toEqual(["비밀", "카페"]);
    }));

  it("상대의 기록(공유된 것 포함)은 수정·삭제·공유 상태 변경을 할 수 없다", () =>
    withTx(async (db) => {
      const { b, ids } = await setup(db);
      expect(await db.as(b, "update memories set title = 'x' where id = $1 returning id", [ids.aShared])).toHaveLength(0);
      expect(await db.as(b, "update memories set share_status = 'shared' where id = $1 returning id", [ids.aDraft])).toHaveLength(0);
      expect(await db.as(b, "delete from memories where id = $1 returning id", [ids.aShared])).toHaveLength(0);
      const [row] = await db.admin<{ title: string; share_status: string }>(
        "select title, share_status from memories where id = $1",
        [ids.aDraft],
      );
      expect(row).toEqual({ title: "A-초안", share_status: "draft" });
    }));

  it("작성자는 초안을 공유로 바꾸고 다시 되돌릴 수 있고, shared_at은 서버가 정한다", () =>
    withTx(async (db) => {
      const { a, b, ids } = await setup(db);
      await db.as(a, "update memories set share_status = 'shared' where id = $1", [ids.aDraft]);
      expect(await titlesSeenBy(db, b)).toContain("A-초안");
      const [s] = await db.admin<{ shared_at: Date | null }>("select shared_at from memories where id = $1", [ids.aDraft]);
      expect(s.shared_at).not.toBeNull();

      await db.as(a, "update memories set share_status = 'draft' where id = $1", [ids.aDraft]);
      expect(await titlesSeenBy(db, b)).not.toContain("A-초안");
      await expectDbError(db.as(a, "update memories set shared_at = now() where id = $1", [ids.aDraft]), "permission denied");
    }));

  it("다른 커플에 기록을 쓰거나, 작성자를 사칭하거나, 기록을 다른 커플로 옮길 수 없다", () =>
    withTx(async (db) => {
      const { a, b, c, e, x, y, ids } = await setup(db);
      await expectDbError(writeMemory(db, a, y, { title: "침입" }), "row-level security");
      await expectDbError(writeMemory(db, e, x, { title: "침입" }), "row-level security");
      // 작성자 사칭: B 명의로 A가 쓰기
      await expectDbError(
        db.as(a, "insert into memories (couple_id, author_id, title, happened_on) values ($1, $2, 'x', '2026-01-01')", [x, b.id]),
        "row-level security",
      );
      await expectDbError(db.as(a, "update memories set couple_id = $1 where id = $2", [y, ids.aShared]), "permission denied");
      await expectDbError(db.as(a, "update memories set author_id = $1 where id = $2", [c.id, ids.aShared]), "permission denied");
    }));

  it("입력 제약: 빈 제목, 잘못된 태그는 DB가 거부한다", () =>
    withTx(async (db) => {
      const { a, x } = await setup(db);
      await expectDbError(writeMemory(db, a, x, { title: "   " }), "check constraint");
      for (const tags of [[" 공백"], ["a,b"], ["#해시"], ["중복", "중복"], ["A", "a"], ["가".repeat(21)], Array.from({ length: 11 }, (_, i) => `t${i}`)]) {
        await expectDbError(writeMemory(db, a, x, { title: "t", tags }), "check constraint");
      }
      await writeMemory(db, a, x, { title: "ok", tags: ["한강", "산책", "night walk"] });
    }));
});

describe("기록: 검색·필터 (호출자 RLS 적용)", () => {
  it("검색은 내가 볼 수 있는 기록에서만 찾는다", () =>
    withTx(async (db) => {
      const { a, b, c } = await setup(db);
      const search = async (u: typeof a, q: string) =>
        (await db.as<{ title: string }>(u, "select title from search_memories(p_query => $1)", [q])).map((r) => r.title);
      expect(await search(b, "초안")).toEqual(["B-초안"]); // A-초안은 안 보임
      expect(await search(a, "초안")).toEqual(["A-초안"]);
      expect(await search(c, "A-")).toEqual([]);
    }));

  it("본문·태그 검색, 태그·기간·공유상태 필터, LIKE 특수문자는 글자 그대로 취급", () =>
    withTx(async (db) => {
      const [a, b] = await db.createUsers("Ana", "Ben");
      const x = await db.pair(a, b);
      await writeMemory(db, a, x, { title: "봄 피크닉", body: "한강에서 김밥", happenedOn: "2026-04-05", tags: ["한강"], share: "shared" });
      await writeMemory(db, a, x, { title: "여름 바다", body: "100% 행복", happenedOn: "2026-07-20", tags: ["바다"], share: "shared" });
      await writeMemory(db, a, x, { title: "가을 산책", body: "낙엽", happenedOn: "2026-10-01", tags: ["한강", "산책"] });

      const run = async (args: string, params: unknown[] = []) =>
        (await db.as<{ title: string }>(a, `select title from search_memories(${args})`, params)).map((r) => r.title);

      expect(await run("")).toEqual(["가을 산책", "여름 바다", "봄 피크닉"]); // 최신순
      expect(await run("p_query => $1", ["김밥"])).toEqual(["봄 피크닉"]);
      expect(await run("p_query => $1", ["산책"])).toEqual(["가을 산책"]);
      expect(await run("p_tag => $1", ["한강"])).toEqual(["가을 산책", "봄 피크닉"]);
      expect(await run("p_from => $1, p_to => $2", ["2026-06-01", "2026-08-31"])).toEqual(["여름 바다"]);
      expect(await run("p_scope => 'draft'")).toEqual(["가을 산책"]);
      expect(await run("p_query => $1", ["100%"])).toEqual(["여름 바다"]);
      expect(await run("p_query => $1", ["%"])).toEqual(["여름 바다"]);
      expect(await run("p_query => $1", ["_"])).toEqual([]);
      expect(await run("p_limit => 1, p_offset => 1")).toEqual(["여름 바다"]);
    }));
});

describe("기록: 연결 해제 후", () => {
  it("각자 자기가 쓴 기록만 읽기 전용으로 남고, 상대 기록은 공유됐던 것도 차단된다", () =>
    withTx(async (db) => {
      const { a, b, ids } = await setup(db);
      await db.as(b, "select leave_couple()");

      expect(await titlesSeenBy(db, a)).toEqual(["A-공유", "A-초안"]);
      expect(await titlesSeenBy(db, b)).toEqual(["B-공유", "B-초안"]);

      // 읽기 전용
      expect(await db.as(a, "update memories set title = 'x' where id = $1 returning id", [ids.aShared])).toHaveLength(0);
      expect(await db.as(a, "delete from memories where id = $1 returning id", [ids.aShared])).toHaveLength(0);
      // 활성 커플이 아니므로 검색 대상도 아니다 (보관 기록은 보관 화면에서만)
      expect(await db.as(a, "select * from search_memories()")).toHaveLength(0);
    }));

  it("새 커플을 만들어도 이전 커플의 기록이 새 상대에게 보이지 않는다", () =>
    withTx(async (db) => {
      const { a, e } = await setup(db);
      await db.as(a, "select leave_couple()");
      const z = await db.pair(a, e);
      await writeMemory(db, a, z, { title: "새 공유", share: "shared" });
      expect(await titlesSeenBy(db, e)).toEqual(["새 공유"]);
      // A 본인은 보관 기록 + 새 기록을 모두 본다
      expect(await titlesSeenBy(db, a)).toEqual(["A-공유", "A-초안", "새 공유"]);
    }));

  it("보관 기간이 지나면 기록도 영구 삭제된다", () =>
    withTx(async (db) => {
      const { a, x } = await setup(db);
      await db.as(a, "select leave_couple()");
      await db.admin("update couples set purge_after = now() - interval '1 second' where id = $1", [x]);
      expect(await titlesSeenBy(db, a)).toEqual([]);
      await db.admin("select private.purge_dissolved_couples()");
      expect(await db.admin("select 1 from memories where couple_id = $1", [x])).toHaveLength(0);
    }));
});
