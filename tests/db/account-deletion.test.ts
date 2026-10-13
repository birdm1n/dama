import { describe, it, expect } from "vitest";
import { withTx, writeMemory, insertPhoto, addPlace, createPost } from "./helpers";

/**
 * 회원 탈퇴 = (활성 커플이면 leave_couple) → Auth Admin API로 auth.users 삭제.
 * 여기서는 그 결과가 DB에서 어떻게 정리되는지 검증한다.
 */
describe("회원 탈퇴 시 데이터 정리", () => {
  it("내 데이터는 모두 지워지고 파일은 삭제 대기열로, 상대의 데이터는 그대로 남는다", () =>
    withTx(async (db) => {
      await db.admin("delete from private.storage_deletion_queue");
      const [a, b, c] = await db.createUsers("Ana", "Ben", "Cy");
      const x = await db.pair(a, b);
      const aMem = await writeMemory(db, a, x, { title: "A의 기록", share: "shared" });
      const bMem = await writeMemory(db, b, x, { title: "B의 기록", share: "shared" });
      const aPhoto = await insertPhoto(db, a, x, { memoryId: aMem });
      await insertPhoto(db, b, x, { memoryId: bMem });
      await addPlace(db, a, x, aMem);
      const post = await createPost(db, a, { title: "A의 공개 글" });
      await db.as(a, "insert into public_post_images (post_id, seq, storage_path, width, height) values ($1, 0, $2, 1, 1)", [post, `${post}/${crypto.randomUUID()}.webp`]);
      const cPost = await createPost(db, c, { title: "C의 공개 글" });
      await db.as(a, "insert into post_likes (post_id, user_id) values ($1, $2)", [cPost, a.id]);
      await db.as(a, "insert into user_blocks (blocker_id, blocked_id) values ($1, $2)", [a.id, c.id]);

      // 앱의 탈퇴 순서: 연결 해제 → 계정 삭제
      await db.as(a, "select leave_couple()");
      await db.admin("delete from auth.users where id = $1", [a.id]);

      const left = async (sql: string, params: unknown[] = []) => (await db.admin<{ n: number }>(sql, params))[0].n;
      expect(await left("select count(*)::int as n from profiles where id = $1", [a.id])).toBe(0);
      expect(await left("select count(*)::int as n from memories where author_id = $1", [a.id])).toBe(0);
      expect(await left("select count(*)::int as n from photos where uploader_id = $1", [a.id])).toBe(0);
      expect(await left("select count(*)::int as n from memory_places where memory_id = $1", [aMem])).toBe(0);
      expect(await left("select count(*)::int as n from public_posts where author_id = $1", [a.id])).toBe(0);
      expect(await left("select count(*)::int as n from couple_members where user_id = $1", [a.id])).toBe(0);
      expect(await left("select count(*)::int as n from user_blocks where blocker_id = $1", [a.id])).toBe(0);
      // 좋아요 수도 트리거로 줄어든다
      expect((await db.admin<{ like_count: number }>("select like_count from public_posts where id = $1", [cPost]))[0].like_count).toBe(0);

      // 파일 정리 대기열: 내 사진(원본·썸네일)과 공개 글 이미지
      const queued = (await db.admin<{ path: string }>("select path from private.storage_deletion_queue")).map((r) => r.path);
      expect(queued).toEqual(expect.arrayContaining([aPhoto.storage_path, aPhoto.thumb_path]));
      expect(queued.some((p) => p.startsWith(`${post}/`))).toBe(true);

      // 상대: 자기 기록·사진은 보관함에 남는다
      expect((await db.as<{ title: string }>(b, "select title from memories")).map((r) => r.title)).toEqual(["B의 기록"]);
      expect(await db.as(b, "select id from photos")).toHaveLength(1);
      // 다른 사용자의 공개 글은 영향 없음
      expect(await db.as(c, "select title from public_posts where id = $1", [cPost])).toHaveLength(1);
    }));
});
