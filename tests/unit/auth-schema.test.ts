import { describe, it, expect } from "vitest";
import { signUpSchema } from "@/features/auth/schema";
import { daysTogether } from "@/lib/dates";

describe("회원가입 입력 검증", () => {
  const ok = { displayName: "  하나 ", email: " Hana@Example.com ", password: "abcd1234" };

  it("정상 입력은 정규화된다", () => {
    expect(signUpSchema.parse(ok)).toEqual({ displayName: "하나", email: "hana@example.com", password: "abcd1234" });
  });

  it.each([
    [{ ...ok, displayName: "   " }, "displayName"],
    [{ ...ok, displayName: "가".repeat(31) }, "displayName"],
    [{ ...ok, email: "nope" }, "email"],
    [{ ...ok, password: "short1" }, "password"],
    [{ ...ok, password: "onlyletters" }, "password"],
    [{ ...ok, password: "12345678" }, "password"],
  ])("잘못된 입력 거부 (%#)", (input, field) => {
    const r = signUpSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error!.issues.some((i) => i.path[0] === field)).toBe(true);
  });
});

describe("daysTogether", () => {
  it("기념일 당일은 1일째", () => expect(daysTogether("2026-10-12", new Date(2026, 9, 12))).toBe(1));
  it("100일째", () => expect(daysTogether("2026-01-01", new Date(2026, 3, 10))).toBe(100));
});
