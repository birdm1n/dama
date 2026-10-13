import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { withTx, expectDbError, createPost, type Db, type TestUser } from "./helpers";

async function setup(db: Db) {
  // 실제 스택 DB에는 다른 실행에서 남은 공개 글이 있을 수 있다. 트랜잭션 안에서 비우므로 테스트 후 원래대로 돌아간다.
  await db.admin("delete from public_posts");
  await db.admin("delete from private.storage_deletion_queue");
  const [a, b, c, d, e] = await db.createUsers("Ana", "Ben", "Cy", "Di", "Eve");
  await db.pair(a, b);
  await db.pair(c, d);
  return { a, b, c, d, e };
}

const titles = async (db: Db, u: TestUser) =>
  (await db.as<{ title: string }>(u, "select title from public_posts order by title")).map((r) => r.title);

describe("공개 게시물: 가시성", () => {
  it("공개 글은 커플과 상관없이 로그인한 누구나, anon은 아무것도", () =>
    withTx(async (db) => {
      const { a, c, e } = await setup(db);
      await createPost(db, a, { title: "A의 코스" });
      expect(await titles(db, c)).toEqual(["A의 코스"]);
      expect(await titles(db, e)).toEqual(["A의 코스"]);
      await expectDbError(db.as("anon", "select * from public_posts"), "permission denied");
      await expectDbError(db.as("anon", "select * from search_public_posts()"), "permission denied");
    }));

  it("숨긴 글은 작성자만 본다 (같은 커플 상대도 못 봄)", () =>
    withTx(async (db) => {
      const { a, b, c } = await setup(db);
      const id = await createPost(db, a, { title: "숨길 글" });
      await db.as(a, "update public_posts set status = 'hidden' where id = $1", [id]);
      expect(await titles(db, a)).toEqual(["숨길 글"]);
      expect(await titles(db, b)).toEqual([]);
      expect(await titles(db, c)).toEqual([]);
    }));

  it("공개 글에는 커플 정보·작성자 프로필이 없다", () =>
    withTx(async (db) => {
      const { a, c } = await setup(db);
      await createPost(db, a);
      const [row] = await db.as<Record<string, unknown>>(c, "select * from public_posts");
      expect(Object.keys(row)).not.toContain("couple_id");
      // 다른 커플은 작성자 프로필을 읽을 수 없다
      expect(await db.as(c, "select * from profiles where id = $1", [a.id])).toEqual([]);
    }));
});

describe("공개 게시물: 쓰기 규칙", () => {
  it("남의 이름으로 쓰거나 남의 글을 수정·삭제할 수 없다", () =>
    withTx(async (db) => {
      const { a, c } = await setup(db);
      await expectDbError(
        db.as(c, "insert into public_posts (author_id, kind, title) values ($1, 'place', 'x')", [a.id]),
        "row-level security",
      );
      const id = await createPost(db, a);
      expect(await db.as(c, "update public_posts set title = 'x' where id = $1 returning id", [id])).toEqual([]);
      expect(await db.as(c, "update public_posts set status = 'hidden' where id = $1 returning id", [id])).toEqual([]);
      expect(await db.as(c, "delete from public_posts where id = $1 returning id", [id])).toEqual([]);
      await expectDbError(db.as(a, "update public_posts set like_count = 999 where id = $1", [id]), "permission denied");
      await expectDbError(db.as(a, "update public_posts set author_id = $1 where id = $2", [c.id, id]), "permission denied");
    }));

  it("남의 글에 장소·이미지를 붙일 수 없고, 이미지 경로는 게시물 폴더 형식이어야 한다", () =>
    withTx(async (db) => {
      const { a, c } = await setup(db);
      const id = await createPost(db, a);
      await expectDbError(
        db.as(c, "insert into public_post_places (post_id, seq, name, lat, lng) values ($1, 0, 'x', 37, 127)", [id]),
        "row-level security",
      );
      await expectDbError(
        db.as(c, "insert into public_post_images (post_id, seq, storage_path, width, height) values ($1, 0, $2, 1, 1)", [id, `${id}/${randomUUID()}.webp`]),
        "row-level security",
      );
      await expectDbError(
        db.as(a, "insert into public_post_images (post_id, seq, storage_path, width, height) values ($1, 0, $2, 1, 1)", [id, `couple/${randomUUID()}.webp`]),
        "row-level security",
      );
      await db.as(a, "insert into public_post_images (post_id, seq, storage_path, width, height) values ($1, 0, $2, 1, 1)", [id, `${id}/${randomUUID()}.webp`]);
    }));

  it("하루 10개 제한", () =>
    withTx(async (db) => {
      const { a } = await setup(db);
      for (let i = 0; i < 10; i++) await createPost(db, a, { title: `글${i}` });
      await expectDbError(createPost(db, a), "POST_RATE_LIMITED");
    }));
});

describe("좋아요·북마크", () => {
  it("내 행만 보이고, 카운트는 트리거가 맞춘다(직접 조작 불가)", () =>
    withTx(async (db) => {
      const { a, c, e } = await setup(db);
      const id = await createPost(db, a);
      await db.as(c, "insert into post_likes (post_id, user_id) values ($1, $2)", [id, c.id]);
      await db.as(e, "insert into post_likes (post_id, user_id) values ($1, $2)", [id, e.id]);
      await db.as(e, "insert into post_bookmarks (post_id, user_id) values ($1, $2)", [id, e.id]);
      expect(await db.as(c, "select user_id from post_likes")).toEqual([{ user_id: c.id }]);
      expect(await db.as(a, "select * from post_bookmarks")).toEqual([]); // 작성자도 누가 저장했는지 모른다
      const [p] = await db.as<{ like_count: number; bookmark_count: number }>(c, "select like_count, bookmark_count from public_posts where id = $1", [id]);
      expect(p).toEqual({ like_count: 2, bookmark_count: 1 });
      await db.as(c, "delete from post_likes where post_id = $1", [id]);
      const [p2] = await db.as<{ like_count: number }>(c, "select like_count from public_posts where id = $1", [id]);
      expect(p2.like_count).toBe(1);
    }));

  it("남 대신 좋아요를 누르거나 남의 좋아요를 지울 수 없고, 숨긴 글엔 누를 수 없다", () =>
    withTx(async (db) => {
      const { a, c, e } = await setup(db);
      const id = await createPost(db, a);
      await expectDbError(db.as(c, "insert into post_likes (post_id, user_id) values ($1, $2)", [id, e.id]), "row-level security");
      await db.as(e, "insert into post_likes (post_id, user_id) values ($1, $2)", [id, e.id]);
      expect(await db.as(c, "delete from post_likes where post_id = $1 returning user_id", [id])).toEqual([]);
      await db.as(a, "update public_posts set status = 'hidden' where id = $1", [id]);
      await expectDbError(db.as(c, "insert into post_bookmarks (post_id, user_id) values ($1, $2)", [id, c.id]), "row-level security");
    }));
});

describe("차단", () => {
  it("차단하면 서로의 글이 양쪽 모두에게 안 보이고, 상대는 내가 차단했는지 알 수 없다", () =>
    withTx(async (db) => {
      const { a, c, e } = await setup(db);
      await createPost(db, a, { title: "A글" });
      await createPost(db, c, { title: "C글" });
      await db.as(c, "insert into user_blocks (blocker_id, blocked_id) values ($1, $2)", [c.id, a.id]);
      expect(await titles(db, c)).toEqual(["C글"]);
      expect(await titles(db, a)).toEqual(["A글"]);
      expect(await titles(db, e)).toEqual(["A글", "C글"]);
      expect(await db.as(a, "select * from user_blocks")).toEqual([]);
      // 검색 결과도 같다
      expect((await db.as<{ title: string }>(c, "select title from search_public_posts()")).map((r) => r.title)).toEqual(["C글"]);
    }));

  it("남 대신 차단할 수 없고 자기 자신은 차단할 수 없다", () =>
    withTx(async (db) => {
      const { a, c, e } = await setup(db);
      await expectDbError(db.as(c, "insert into user_blocks (blocker_id, blocked_id) values ($1, $2)", [e.id, a.id]), "row-level security");
      await expectDbError(db.as(c, "insert into user_blocks (blocker_id, blocked_id) values ($1, $1)", [c.id]), "check constraint");
    }));
});

describe("신고", () => {
  it("내 신고만 보이고, 자기 글은 신고할 수 없고, 같은 글은 한 번만", () =>
    withTx(async (db) => {
      const { a, c, e } = await setup(db);
      const id = await createPost(db, a);
      await expectDbError(db.as(a, "insert into post_reports (post_id, reporter_id, reason) values ($1, $2, 'spam')", [id, a.id]), "row-level security");
      await db.as(c, "insert into post_reports (post_id, reporter_id, reason) values ($1, $2, 'spam')", [id, c.id]);
      await expectDbError(db.as(c, "insert into post_reports (post_id, reporter_id, reason) values ($1, $2, 'other')", [id, c.id]), "duplicate key");
      await db.as(e, "insert into post_reports (post_id, reporter_id, reason) values ($1, $2, 'privacy')", [id, e.id]);
      expect(await db.as(c, "select reason from post_reports")).toEqual([{ reason: "spam" }]);
      expect(await db.as(a, "select * from post_reports")).toEqual([]); // 작성자는 누가 신고했는지 모른다
      await expectDbError(db.as(c, "update post_reports set status = 'dismissed'"), "permission denied");
    }));

  it("서로 다른 3명이 신고하면 자동으로 숨겨지고, 작성자는 다시 공개할 수 없다", () =>
    withTx(async (db) => {
      const { a, b, c, d, e } = await setup(db);
      const id = await createPost(db, a, { title: "문제 글" });
      for (const u of [c, d]) await db.as(u, "insert into post_reports (post_id, reporter_id, reason) values ($1, $2, 'spam')", [id, u.id]);
      expect(await titles(db, e)).toEqual(["문제 글"]);
      await db.as(e, "insert into post_reports (post_id, reporter_id, reason) values ($1, $2, 'spam')", [id, e.id]);
      expect(await titles(db, e)).toEqual([]);
      expect(await titles(db, b)).toEqual([]);
      const [mine] = await db.as<{ status: string }>(a, "select status from public_posts where id = $1", [id]);
      expect(mine.status).toBe("under_review");
      expect(await db.as(a, "update public_posts set status = 'published' where id = $1 returning id", [id])).toEqual([]);
      // 작성자는 지울 수는 있다
      expect(await db.as(a, "delete from public_posts where id = $1 returning id", [id])).toHaveLength(1);
    }));
});

describe("게시물 이미지 파일 접근", () => {
  it("볼 수 있는 게시물의 이미지만 읽히고, 숨기거나 차단하면 바로 못 읽는다", () =>
    withTx(async (db) => {
      const { a, c, e } = await setup(db);
      const id = await createPost(db, a);
      const path = `${id}/${randomUUID()}.webp`;
      await db.as(a, "insert into storage.objects (bucket_id, name, owner) values ('post-images', $1, $2)", [path, a.id]);
      await db.as(a, "insert into public_post_images (post_id, seq, storage_path, width, height) values ($1, 0, $2, 1, 1)", [id, path]);
      const seen = async (u: TestUser) => (await db.as(u, "select name from storage.objects where bucket_id = 'post-images'")).length;
      expect(await seen(c)).toBe(1);
      await db.as(e, "insert into user_blocks (blocker_id, blocked_id) values ($1, $2)", [e.id, a.id]);
      expect(await seen(e)).toBe(0);
      await db.as(a, "update public_posts set status = 'hidden' where id = $1", [id]);
      expect(await seen(c)).toBe(0);
      expect(await seen(a)).toBe(1);
    }));

  it("남의 게시물 폴더에는 업로드할 수 없고, 형식이 다른 경로도 거부(다른 버킷에 영향 없음)", () =>
    withTx(async (db) => {
      const { a, c } = await setup(db);
      const id = await createPost(db, a);
      await expectDbError(
        db.as(c, "insert into storage.objects (bucket_id, name, owner) values ('post-images', $1, $2)", [`${id}/${randomUUID()}.webp`, c.id]),
        "row-level security",
      );
      await expectDbError(
        db.as(a, "insert into storage.objects (bucket_id, name, owner) values ('post-images', 'not-a-uuid/x.webp', $1)", [a.id]),
        "row-level security",
      );
      // 사진 버킷 조회가 post-images 정책 때문에 깨지지 않는다
      await db.as(c, "select * from storage.objects where bucket_id = 'couple-photos'");
    }));

  it("게시물을 지우면 이미지 파일이 삭제 대기열에 들어간다", () =>
    withTx(async (db) => {
      const { a } = await setup(db);
      const id = await createPost(db, a);
      const path = `${id}/${randomUUID()}.webp`;
      await db.as(a, "insert into public_post_images (post_id, seq, storage_path, width, height) values ($1, 0, $2, 1, 1)", [id, path]);
      await db.as(a, "delete from public_posts where id = $1", [id]);
      const q = await db.admin<{ bucket_id: string; path: string }>("select bucket_id, path from private.storage_deletion_queue where path = $1", [path]);
      expect(q).toEqual([{ bucket_id: "post-images", path }]);
    }));
});

describe("검색", () => {
  it("제목·본문·지역·태그, 종류·태그 필터", () =>
    withTx(async (db) => {
      const { a, c } = await setup(db);
      await createPost(db, a, { title: "성수 카페 투어", kind: "course", tags: ["카페"], area: "성수동" });
      await createPost(db, a, { title: "한강 노을", kind: "place", tags: ["한강"], area: "망원" });
      const run = async (args: string, params: unknown[] = []) =>
        (await db.as<{ title: string }>(c, `select title from search_public_posts(${args})`, params)).map((r) => r.title).sort();
      expect(await run("p_query => $1", ["망원"])).toEqual(["한강 노을"]);
      expect(await run("p_kind => 'course'")).toEqual(["성수 카페 투어"]);
      expect(await run("p_tag => $1", ["한강"])).toEqual(["한강 노을"]);
      expect(await run("p_query => $1", ["%"])).toEqual([]);
    }));
});
