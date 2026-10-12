import { describe, it, expect } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath (오픈 리다이렉트 방지)", () => {
  it.each([
    ["/couple", "/couple"],
    ["/invite/abc_DEF-123", "/invite/abc_DEF-123"],
    ["/home?x=1#y", "/home?x=1#y"],
  ])("허용: %s", (input, expected) => expect(safeNextPath(input)).toBe(expected));

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    "/\u0000x",
    undefined,
    null,
    42,
  ])("거부: %s", (input) => expect(safeNextPath(input)).toBe("/home"));
});
