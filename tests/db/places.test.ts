import { describe, it, expect } from "vitest";
import { withTx, expectDbError, writeMemory, addPlace, type Db, type TestUser } from "./helpers";

async function setup(db: Db) {
  const [a, b, c, d] = await db.createUsers("Ana", "Ben", "Cy", "Di");
  const x = await db.pair(a, b);
  const y = await db.pair(c, d);
  const aShared = await writeMemory(db, a, x, { title: "A-공유", share: "shared" });
  const aDraft = await writeMemory(db, a, x, { title: "A-초안" });
  const bShared = await writeMemory(db, b, x, { title: "B-공유", share: "shared" });
  return { a, b, c, d, x, y, aShared, aDraft, bShared };
}

const placesSeen = async (db: Db, u: TestUser) =>
  (await db.as<{ name: string }>(u, "select name from memory_places order by name")).map((r) => r.name);

describe("장소: 가시성은 기록과 같다", () => {
  it("초안 기록의 장소는 작성자만, 공유 기록의 장소는 둘 다, 다른 커플은 못 본다", () =>
    withTx(async (db) => {
      const { a, b, c, x, aShared, aDraft } = await setup(db);
      await addPlace(db, a, x, aShared, { name: "공유-카페" });
      await addPlace(db, a, x, aDraft, { name: "초안-선물가게" });
      expect(await placesSeen(db, a)).toEqual(["공유-카페", "초안-선물가게"]);
      expect(await placesSeen(db, b)).toEqual(["공유-카페"]);
      expect(await placesSeen(db, c)).toEqual([]);
      await expectDbError(db.as("anon", "select * from memory_places"), "permission denied");
    }));

  it("기록을 '나만 보기'로 되돌리면 장소도 상대에게서 사라진다", () =>
    withTx(async (db) => {
      const { a, b, x, aShared } = await setup(db);
      await addPlace(db, a, x, aShared, { name: "공유-카페" });
      await db.as(a, "update memories set share_status = 'draft' where id = $1", [aShared]);
      expect(await placesSeen(db, b)).toEqual([]);
    }));

  it("연결 해제 후엔 내 기록의 장소만 보관된다", () =>
    withTx(async (db) => {
      const { a, b, x, aShared, bShared } = await setup(db);
      await addPlace(db, a, x, aShared, { name: "A장소" });
      await addPlace(db, b, x, bShared, { name: "B장소" });
      await db.as(b, "select leave_couple()");
      expect(await placesSeen(db, a)).toEqual(["A장소"]);
      expect(await placesSeen(db, b)).toEqual(["B장소"]);
      // 보관 중엔 수정 불가
      expect(await db.as(a, "update memory_places set name = 'x' returning id")).toHaveLength(0);
      expect(await db.as(a, "delete from memory_places returning id")).toHaveLength(0);
    }));
});

describe("장소: 쓰기 규칙", () => {
  it("상대의 기록(공유된 것 포함)·다른 커플 기록에 장소를 넣을 수 없다", () =>
    withTx(async (db) => {
      const { a, c, x, y, bShared } = await setup(db);
      await expectDbError(addPlace(db, a, x, bShared), "row-level security");
      const cMem = await writeMemory(db, c, y, { title: "C" });
      await expectDbError(addPlace(db, a, x, cMem), "row-level security");
      await expectDbError(addPlace(db, a, y, cMem), "row-level security");
    }));

  it("couple_id를 다른 커플로 속여 넣을 수 없다", () =>
    withTx(async (db) => {
      const { a, y, aShared } = await setup(db);
      await expectDbError(addPlace(db, a, y, aShared), "row-level security");
    }));

  it("상대 기록의 장소는 수정·삭제·순서변경 불가, 좌표는 아무도 바꿀 수 없다", () =>
    withTx(async (db) => {
      const { a, b, x, aShared } = await setup(db);
      const p1 = await addPlace(db, a, x, aShared, { name: "1", seq: 0 });
      await addPlace(db, a, x, aShared, { name: "2", seq: 1 });
      expect(await db.as(b, "update memory_places set name = 'x' where id = $1 returning id", [p1])).toHaveLength(0);
      expect(await db.as(b, "delete from memory_places where id = $1 returning id", [p1])).toHaveLength(0);
      const [{ ok }] = await db.as<{ ok: boolean }>(b, "select move_memory_place($1, 1) as ok", [p1]);
      expect(ok).toBe(false);
      await expectDbError(db.as(a, "update memory_places set lat = 0 where id = $1", [p1]), "permission denied");
    }));

  it("작성자는 순서를 바꿀 수 있다", () =>
    withTx(async (db) => {
      const { a, x, aShared } = await setup(db);
      const p1 = await addPlace(db, a, x, aShared, { name: "첫째", seq: 0 });
      await addPlace(db, a, x, aShared, { name: "둘째", seq: 1 });
      await addPlace(db, a, x, aShared, { name: "셋째", seq: 2 });
      const order = async () =>
        (await db.as<{ name: string }>(a, "select name from memory_places order by seq, id")).map((r) => r.name);
      const [{ ok }] = await db.as<{ ok: boolean }>(a, "select move_memory_place($1, 1) as ok", [p1]);
      expect(ok).toBe(true);
      expect(await order()).toEqual(["둘째", "첫째", "셋째"]);
      await db.as(a, "select move_memory_place($1, 1)", [p1]);
      expect(await order()).toEqual(["둘째", "셋째", "첫째"]);
      const [{ ok: atEnd }] = await db.as<{ ok: boolean }>(a, "select move_memory_place($1, 1) as ok", [p1]);
      expect(atEnd).toBe(false);
    }));

  it("출처·정확도 규칙과 장소 개수 제한", () =>
    withTx(async (db) => {
      const { a, x, aShared } = await setup(db);
      await expectDbError(addPlace(db, a, x, aShared, { source: "manual", accuracy: 10 }), "check constraint");
      await expectDbError(addPlace(db, a, x, aShared, { lat: 91 }), "check constraint");
      await expectDbError(addPlace(db, a, x, aShared, { name: " " }), "check constraint");
      await addPlace(db, a, x, aShared, { source: "device", accuracy: 25 });
      for (let i = 1; i < 20; i++) await addPlace(db, a, x, aShared, { seq: i });
      await expectDbError(addPlace(db, a, x, aShared, { seq: 20 }), "TOO_MANY_PLACES");
    }));

  it("기록을 지우면 장소도 지워진다", () =>
    withTx(async (db) => {
      const { a, x, aShared } = await setup(db);
      await addPlace(db, a, x, aShared);
      await db.as(a, "delete from memories where id = $1", [aShared]);
      expect(await db.admin("select 1 from memory_places where memory_id = $1", [aShared])).toEqual([]);
    }));
});
