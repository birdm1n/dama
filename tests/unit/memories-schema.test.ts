import { describe, it, expect } from "vitest";
import { parseFilter, parseTags, todayInSeoul } from "@/features/memories/schema";

describe("parseTags", () => {
  it("쉼표·#·줄바꿈으로 나누고 공백 정리, 대소문자 무시 중복 제거", () => {
    expect(parseTags("카페, 한강 #산책\n Night  Walk, night walk,,")).toEqual({ tags: ["카페", "한강", "산책", "Night Walk"] });
  });
  it("빈 입력은 빈 배열", () => expect(parseTags("  , # ")).toEqual({ tags: [] }));
  it("20자 초과 태그 거부", () => expect(parseTags("가".repeat(21)).error).toBeTruthy());
  it("11개 이상 거부", () => expect(parseTags(Array.from({ length: 11 }, (_, i) => `t${i}`).join(",")).error).toBeTruthy());
  it("제어 문자 제거", () => expect(parseTags("a\u0007b").tags).toEqual(["ab"]));
});

describe("parseFilter", () => {
  it("유효한 값만 남긴다", () => {
    expect(parseFilter({ q: " 카페 ", tag: "산책", scope: "draft", from: "2026-01-01", page: "2" })).toEqual({
      q: "카페", tag: "산책", scope: "draft", from: "2026-01-01", to: undefined, page: 2,
    });
  });
  it("잘못된 값은 무시한다 (오류 대신 기본값)", () => {
    expect(parseFilter({ scope: "everyone", from: "어제", page: "-3", q: ["a", "b"] })).toEqual({
      q: "a", tag: undefined, scope: undefined, from: undefined, to: undefined, page: undefined,
    });
  });
});

describe("todayInSeoul", () => {
  it("UTC 자정 직전이라도 서울 날짜를 쓴다", () => {
    expect(todayInSeoul(new Date("2026-10-12T20:00:00Z"))).toBe("2026-10-13");
  });
});
