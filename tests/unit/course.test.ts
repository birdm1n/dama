import { describe, it, expect } from "vitest";
import { buildCourses, courseLine, boundsOf, sourceLabel, type MapPlace } from "@/features/map/course";

let n = 0;
const place = (o: Partial<MapPlace>): MapPlace => ({
  id: `p${n++}`, memoryId: "m1", memoryTitle: "t", memoryCreatedAt: "2026-05-17T01:00:00Z", happenedOn: "2026-05-17",
  shareStatus: "shared", isMine: true, seq: 0, name: "x", address: null, lat: 37.5, lng: 127, locationSource: "manual", accuracyM: null,
  ...o,
});

describe("buildCourses", () => {
  it("날짜별로 묶고 최근 날짜 먼저, 날짜 안에서는 기록을 쓴 순서 → 장소 순서", () => {
    const courses = buildCourses([
      place({ name: "카페", memoryId: "m2", memoryCreatedAt: "2026-05-17T09:00:00Z", seq: 0 }),
      place({ name: "공원", memoryId: "m1", memoryCreatedAt: "2026-05-17T05:00:00Z", seq: 1 }),
      place({ name: "역", memoryId: "m1", memoryCreatedAt: "2026-05-17T05:00:00Z", seq: 0 }),
      place({ name: "바다", happenedOn: "2026-07-20", memoryId: "m3" }),
    ]);
    expect(courses.map((c) => c.date)).toEqual(["2026-07-20", "2026-05-17"]);
    expect(courses[1].places.map((p) => p.name)).toEqual(["역", "공원", "카페"]);
    expect(courses[1].memoryCount).toBe(2);
  });
});

describe("courseLine", () => {
  it("2곳 이상일 때만 선, 연속된 같은 지점은 한 번만", () => {
    expect(courseLine([place({})])).toBeNull();
    expect(courseLine([place({}), place({})])).toBeNull();
    expect(courseLine([place({ lat: 1, lng: 2 }), place({ lat: 1, lng: 2 }), place({ lat: 3, lng: 4 })])).toEqual([[2, 1], [4, 3]]);
  });
});

it("boundsOf", () => {
  expect(boundsOf([])).toBeNull();
  expect(boundsOf([{ lat: 37.5, lng: 127 }, { lat: 37.6, lng: 126.9 }])).toEqual([[126.9, 37.5], [127, 37.6]]);
});

it("sourceLabel: 출처와 정확도를 구분해 표시", () => {
  expect(sourceLabel({ locationSource: "exif", accuracyM: 8 })).toBe("사진 정보 · ±8m");
  expect(sourceLabel({ locationSource: "device", accuracyM: null })).toBe("기기 위치 · 정확도 정보 없음");
  expect(sourceLabel({ locationSource: "manual", accuracyM: null })).toBe("직접 지정");
});
