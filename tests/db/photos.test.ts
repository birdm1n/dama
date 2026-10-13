import { describe, it, expect } from "vitest";
import {
  withTx, expectDbError, writeMemory, insertPhoto, uploadObject, visibleObjects, photoPaths, type Db,
} from "./helpers";

async function setup(db: Db) {
  // 다른 실행에서 남은 대기열 항목 제외 (트랜잭션 롤백으로 복구됨)
  await db.admin("delete from private.storage_deletion_queue");
  const [a, b, c, d] = await db.createUsers("Ana", "Ben", "Cy", "Di");
  const x = await db.pair(a, b, "X");
  const y = await db.pair(c, d, "Y");
  const aShared = await writeMemory(db, a, x, { title: "A-공유", share: "shared" });
  const aDraft = await writeMemory(db, a, x, { title: "A-초안" });
  const bShared = await writeMemory(db, b, x, { title: "B-공유", share: "shared" });
  return { a, b, c, d, x, y, aShared, aDraft, bShared };
}

const idsSeen = async (db: Db, u: Parameters<Db["as"]>[0]) =>
  (await db.as<{ id: string }>(u, "select id from photos order by id")).map((r) => r.id).sort();

describe("사진: 가시성", () => {
  it("기록에 안 붙은 사진, 초안 기록의 사진은 올린 사람만 본다", () =>
    withTx(async (db) => {
      const { a, b, x, aDraft } = await setup(db);
      const loose = await insertPhoto(db, a, x, { lat: 37.5, lng: 127.0 });
      const inDraft = await insertPhoto(db, a, x, { memoryId: aDraft });
      expect(await idsSeen(db, a)).toEqual([loose.id, inDraft.id].sort());
      expect(await idsSeen(db, b)).toEqual([]);
    }));

  it("공유 기록에 붙은 사진은 상대도 보고, 기록을 '나만 보기'로 돌리면 즉시 사라진다", () =>
    withTx(async (db) => {
      const { a, b, x, aShared } = await setup(db);
      const p = await insertPhoto(db, a, x, { memoryId: aShared, lat: 37.5, lng: 127.0 });
      expect(await idsSeen(db, b)).toEqual([p.id]);
      await db.as(a, "update memories set share_status = 'draft' where id = $1", [aShared]);
      expect(await idsSeen(db, b)).toEqual([]);
    }));

  it("다른 커플·anon은 어떤 사진도 볼 수 없다", () =>
    withTx(async (db) => {
      const { a, c, x, aShared } = await setup(db);
      await insertPhoto(db, a, x, { memoryId: aShared });
      expect(await idsSeen(db, c)).toEqual([]);
      await expectDbError(db.as("anon", "select * from photos"), "permission denied");
    }));
});

describe("사진: 쓰기 규칙", () => {
  it("남의 기록(공유된 것 포함)·다른 커플 기록에는 사진을 붙일 수 없다", () =>
    withTx(async (db) => {
      const { a, b, c, x, y, bShared } = await setup(db);
      await expectDbError(insertPhoto(db, a, x, { memoryId: bShared }), "row-level security");
      const cMem = await writeMemory(db, c, y, { title: "C" });
      await expectDbError(insertPhoto(db, a, x, { memoryId: cMem }), "row-level security");
      const mine = await insertPhoto(db, a, x);
      expect(await db.as(a, "update photos set memory_id = $1 where id = $2 returning id", [bShared, mine.id]).catch((e) => e.message))
        .toMatch(/row-level security/);
      void b;
    }));

  it("다른 커플·다른 사람 폴더 경로로는 사진 행을 만들 수 없다", () =>
    withTx(async (db) => {
      const { a, b, x, y } = await setup(db);
      await expectDbError(insertPhoto(db, a, y), "row-level security");
      await expectDbError(insertPhoto(db, a, x, { path: photoPaths(x, b.id).path }), "row-level security");
      await expectDbError(insertPhoto(db, a, x, { path: `${x}/${a.id}/../evil.webp` }), "row-level security");
      await expectDbError(insertPhoto(db, a, x, { path: `${x}/${a.id}/not-uuid.webp` }), "row-level security");
    }));

  it("상대의 사진은 수정·삭제할 수 없다", () =>
    withTx(async (db) => {
      const { a, b, x, aShared } = await setup(db);
      const p = await insertPhoto(db, a, x, { memoryId: aShared, lat: 37.5, lng: 127.0 });
      expect(await db.as(b, "update photos set lat = null, lng = null, location_source = null where id = $1 returning id", [p.id])).toHaveLength(0);
      expect(await db.as(b, "delete from photos where id = $1 returning id", [p.id])).toHaveLength(0);
      await expectDbError(db.as(a, "update photos set storage_path = 'x' where id = $1", [p.id]), "permission denied");
    }));

  it("위치·시각 메타데이터는 출처와 함께 일관되게 저장된다", () =>
    withTx(async (db) => {
      const { a, x } = await setup(db);
      const bad = (sql: string) => expectDbError(db.as(a, sql, [x, a.id, ...Object.values(photoPaths(x, a.id)).slice(1)]), "check constraint");
      const base = "insert into photos (couple_id, uploader_id, storage_path, thumb_path, width, height, bytes";
      await bad(`${base}, lat, lng) values ($1, $2, $3, $4, 1, 1, 1, 37.5, 127)`); // 출처 없음
      await bad(`${base}, lat, location_source) values ($1, $2, $3, $4, 1, 1, 1, 37.5, 'exif')`); // lng 없음
      await bad(`${base}, lat, lng, location_source) values ($1, $2, $3, $4, 1, 1, 1, 91, 127, 'exif')`); // 범위
      await bad(`${base}, taken_at) values ($1, $2, $3, $4, 1, 1, 1, now())`); // 시각 출처 없음
      await bad(`${base}, accuracy_m) values ($1, $2, $3, $4, 1, 1, 1, 5)`); // 위치 없이 정확도
    }));

  it("사진 행을 지우면 파일 경로가 삭제 대기열에 들어가고, 기록을 지우면 사진은 기록에서만 빠진다", () =>
    withTx(async (db) => {
      const { a, x, aShared } = await setup(db);
      const p = await insertPhoto(db, a, x, { memoryId: aShared });
      const q = await insertPhoto(db, a, x);
      await db.as(a, "delete from memories where id = $1", [aShared]);
      const [left] = await db.admin<{ memory_id: string | null }>("select memory_id from photos where id = $1", [p.id]);
      expect(left.memory_id).toBeNull();
      await db.as(a, "delete from photos where id = $1", [q.id]);
      const queued = await db.admin<{ path: string }>("select path from private.storage_deletion_queue order by id");
      expect(queued.map((r) => r.path)).toEqual([q.storage_path, q.thumb_path]);
    }));
});

describe("사진 파일(storage.objects) 접근", () => {
  it("업로드는 내 활성 커플의 내 폴더에만 된다", () =>
    withTx(async (db) => {
      const { a, b, x, y } = await setup(db);
      await uploadObject(db, a, photoPaths(x, a.id).path);
      await expectDbError(uploadObject(db, a, photoPaths(x, b.id).path), "row-level security");
      await expectDbError(uploadObject(db, a, photoPaths(y, a.id).path), "row-level security");
      await expectDbError(db.as("anon", "insert into storage.objects (bucket_id, name) values ('couple-photos', 'x/y/z.webp')"), "row-level security");
    }));

  it("파일은 볼 수 있는 photos 행이 있을 때만 읽힌다 — 공유 기록의 사진만 상대에게", () =>
    withTx(async (db) => {
      const { a, b, c, x, aShared, aDraft } = await setup(db);
      const shared = await insertPhoto(db, a, x, { memoryId: aShared });
      const draft = await insertPhoto(db, a, x, { memoryId: aDraft });
      for (const p of [shared, draft]) {
        await uploadObject(db, a, p.storage_path);
        await uploadObject(db, a, p.thumb_path);
      }
      expect(await visibleObjects(db, a)).toHaveLength(4);
      expect(await visibleObjects(db, b)).toEqual([shared.storage_path, shared.thumb_path].sort());
      expect(await visibleObjects(db, c)).toEqual([]);

      // 사진 행을 지우면 파일도 즉시 읽을 수 없다(바이트는 대기열 작업이 나중에 삭제)
      await db.as(a, "delete from photos where id = $1", [shared.id]);
      expect(await visibleObjects(db, b)).toEqual([]);
    }));

  it("photos 행이 생기기 전의 파일은 업로드 직후 잠깐 동안 올린 사람만 읽는다", () =>
    withTx(async (db) => {
      const { a, b, x } = await setup(db);
      const { path } = photoPaths(x, a.id);
      await uploadObject(db, a, path);
      expect(await visibleObjects(db, a)).toEqual([path]);
      expect(await visibleObjects(db, b)).toEqual([]);
      await db.admin("update storage.objects set created_at = now() - interval '1 hour' where name = $1", [path]);
      expect(await visibleObjects(db, a)).toEqual([]);
    }));

  it("파일 삭제는 올린 사람만", () =>
    withTx(async (db) => {
      const { a, b, x, aShared } = await setup(db);
      const p = await insertPhoto(db, a, x, { memoryId: aShared });
      await uploadObject(db, a, p.storage_path);
      // Storage API가 삭제 요청 때 설정하는 플래그 (실제 Supabase는 이 플래그 없는 직접 DELETE를 막는다)
      await db.admin("select set_config('storage.allow_delete_query', 'true', true)");
      expect(await db.as(b, "delete from storage.objects where name = $1 returning id", [p.storage_path])).toHaveLength(0);
      expect(await db.as(a, "delete from storage.objects where name = $1 returning id", [p.storage_path])).toHaveLength(1);
    }));

  it("연결 해제 후: 내 사진은 보관 기간 동안 나만, 상대 사진은 공유됐던 것도 차단", () =>
    withTx(async (db) => {
      const { a, b, x, aShared, bShared } = await setup(db);
      const pa = await insertPhoto(db, a, x, { memoryId: aShared });
      const pb = await insertPhoto(db, b, x, { memoryId: bShared });
      await uploadObject(db, a, pa.storage_path);
      await uploadObject(db, b, pb.storage_path);
      await db.as(a, "select leave_couple()");
      expect(await idsSeen(db, a)).toEqual([pa.id]);
      expect(await idsSeen(db, b)).toEqual([pb.id]);
      expect(await visibleObjects(db, a)).toEqual([pa.storage_path]);
      // 보관 사진은 수정·삭제 불가(읽기 전용)
      expect(await db.as(a, "delete from photos where id = $1 returning id", [pa.id])).toHaveLength(0);

      // 영구 삭제 시 파일 경로가 대기열로
      await db.admin("update couples set purge_after = now() - interval '1 second' where id = $1", [x]);
      await db.admin("select private.purge_dissolved_couples()");
      const queued = await db.admin<{ path: string }>("select path from private.storage_deletion_queue");
      expect(queued.map((r) => r.path)).toEqual(expect.arrayContaining([pa.storage_path, pb.storage_path]));
    }));
});

describe("파일 정리 작업 함수", () => {
  it("service_role만 대기열을 가져가고 완료 처리할 수 있다", () =>
    withTx(async (db) => {
      const { a, x } = await setup(db);
      const p = await insertPhoto(db, a, x);
      await db.as(a, "delete from photos where id = $1", [p.id]);

      await expectDbError(db.as(a, "select * from claim_storage_deletions()"), "permission denied");
      await expectDbError(db.as("anon", "select * from claim_storage_deletions()"), "permission denied");
      await expectDbError(db.as(a, "select complete_storage_deletions(array[1::bigint])"), "permission denied");

      const rows = await db.asRole<{ id: string; path: string }>("service_role", "select * from claim_storage_deletions(10)");
      expect(rows.map((r) => r.path).sort()).toEqual([p.storage_path, p.thumb_path].sort());
      // 가져간 항목은 5분 동안 다시 가져가지 않는다
      expect(await db.asRole("service_role", "select * from claim_storage_deletions(10)")).toEqual([]);
      const [{ n }] = await db.asRole<{ n: number }>("service_role", "select complete_storage_deletions($1::bigint[]) as n", [rows.map((r) => r.id)]);
      expect(n).toBe(2);
      expect(await db.admin("select 1 from private.storage_deletion_queue")).toEqual([]);
    }));
});
