import { describe, it, expect } from "vitest";
import { coupleErrorCode, coupleErrorMessage, FALLBACK_ERROR } from "@/features/couple/errors";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

describe("커플 오류 메시지", () => {
  it("Postgres 예외 메시지에서 코드를 뽑아 한국어 문구로 바꾼다", () => {
    expect(coupleErrorCode("INVITE_EXPIRED")).toBe("INVITE_EXPIRED");
    expect(coupleErrorMessage("ERROR: INVITE_EXPIRED")).toContain("만료");
  });

  it("알 수 없는 오류는 내부 메시지를 노출하지 않고 일반 문구를 보여준다", () => {
    expect(coupleErrorMessage('relation "couples" does not exist')).toBe(FALLBACK_ERROR);
    expect(coupleErrorMessage(undefined)).toBe(FALLBACK_ERROR);
  });

  it("DB 함수가 던지는 모든 코드에 문구가 있다", () => {
    const dir = path.resolve(__dirname, "../../supabase/migrations");
    const sql = readdirSync(dir).map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");
    const codes = new Set([...sql.matchAll(/raise exception '([A-Z_]+)'/g)].map((m) => m[1]));
    expect(codes.size).toBeGreaterThan(5);
    for (const code of codes) expect(coupleErrorCode(code), code).toBe(code);
  });
});
