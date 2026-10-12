import { describe, it, expect } from "vitest";
import { metaFromExif, normalizeLocation, parseExifDateTime, distanceM } from "@/features/photos/meta";
import { groupPhotos } from "@/features/photos/grouping";

const kst = () => 540; // 기기 시간대가 서울(+09:00)이라고 가정

describe("parseExifDateTime", () => {
  it("오프셋이 있으면 그대로 쓴다", () => {
    expect(parseExifDateTime("2026:05:17 14:30:00", "+09:00", kst)).toEqual({
      date: new Date("2026-05-17T05:30:00Z"), assumed: false,
    });
    expect(parseExifDateTime("2026:05:17 14:30:00", "-0700", kst)!.date.toISOString()).toBe("2026-05-17T21:30:00.000Z");
  });
  it("오프셋이 없으면 기기 시간대로 가정하고 표시한다", () => {
    expect(parseExifDateTime("2026:05:17 14:30:00", undefined, kst)).toEqual({
      date: new Date("2026-05-17T05:30:00Z"), assumed: true,
    });
  });
  it("형식이 이상하면 null", () => {
    for (const v of ["", "0000:00:00 00:00:00", "2026-13-01 00:00:00", 12345, null]) {
      expect(parseExifDateTime(v, undefined, kst)).toBeNull();
    }
  });
});

describe("metaFromExif", () => {
  const now = new Date("2026-10-13T00:00:00Z");
  it("시각·위치·정확도 추출", () => {
    expect(
      metaFromExif({ DateTimeOriginal: "2026:05:17 14:30:00", OffsetTimeOriginal: "+09:00", latitude: 37.5445999, longitude: 127.0374, GPSHPositioningError: 8 }, now),
    ).toEqual({ takenAt: "2026-05-17T05:30:00.000Z", takenAtAssumedTimezone: false, lat: 37.5446, lng: 127.0374, accuracyM: 8 });
  });
  it("EXIF가 없으면 모두 null", () => {
    expect(metaFromExif(null, now)).toEqual({ takenAt: null, takenAtAssumedTimezone: false, lat: null, lng: null, accuracyM: null });
  });
  it("미래 시각(카메라 시계 오류)은 버린다", () => {
    expect(metaFromExif({ DateTimeOriginal: "2030:01:01 00:00:00", OffsetTimeOriginal: "+09:00" }, now).takenAt).toBeNull();
  });
});

describe("normalizeLocation", () => {
  it("0,0과 범위 밖 좌표는 위치 없음", () => {
    expect(normalizeLocation(0, 0, 5).lat).toBeNull();
    expect(normalizeLocation(95, 10, null).lat).toBeNull();
    expect(normalizeLocation("37", 127, null).lat).toBeNull();
  });
  it("정확도 정보가 없으면 null(알 수 없음)", () => {
    expect(normalizeLocation(37.5, 127, undefined)).toEqual({ lat: 37.5, lng: 127, accuracyM: null });
  });
});

describe("groupPhotos (기록 후보 묶기)", () => {
  const p = (key: string, takenAt: string | null, lat: number | null = null, lng: number | null = null) => ({ key, takenAt, lat, lng });

  it("가까운 시간·장소는 묶고, 시간 간격이나 거리가 멀면 나눈다", () => {
    const groups = groupPhotos([
      p("c", "2026-05-17T07:00:00Z", 37.5451, 127.0399),
      p("a", "2026-05-17T05:30:00Z", 37.5446, 127.0374),
      p("b", "2026-05-17T06:10:00Z", 37.5451, 127.0399),
      p("far", "2026-05-17T07:20:00Z", 35.1587, 129.1604), // 부산: 시간은 가깝지만 멀다
      p("next", "2026-05-18T03:00:00Z"),                     // 다음 날
      p("x", null),
    ]);
    expect(groups.map((g) => g.items.map((i) => i.key))).toEqual([["a", "b", "c"], ["far"], ["next"], ["x"]]);
    expect(groups[0].start).toBe("2026-05-17T05:30:00Z");
    expect(groups[0].end).toBe("2026-05-17T07:00:00Z");
    expect(groups.at(-1)!.hasTime).toBe(false);
  });

  it("위치가 없는 사진은 시간만으로 판단한다", () => {
    const g = groupPhotos([p("a", "2026-05-17T05:00:00Z", 37.5, 127), p("b", "2026-05-17T06:00:00Z"), p("c", "2026-05-17T06:30:00Z", 37.5, 127)]);
    expect(g.map((x) => x.items.map((i) => i.key))).toEqual([["a", "b", "c"]]);
  });
});

it("distanceM", () => {
  expect(Math.round(distanceM({ lat: 37.5446, lng: 127.0374 }, { lat: 37.5451, lng: 127.0399 }))).toBeGreaterThan(200);
  expect(Math.round(distanceM({ lat: 37.5446, lng: 127.0374 }, { lat: 37.5451, lng: 127.0399 }))).toBeLessThan(260);
});
