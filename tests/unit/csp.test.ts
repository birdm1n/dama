import { describe, it, expect } from "vitest";
import { buildCsp, newNonce, originOf } from "@/lib/security/csp";

const parse = (csp: string) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("CSP", () => {
  const prod = parse(buildCsp({ nonce: "abc", supabaseUrl: "https://xyz.supabase.co/", dev: false, https: true }));

  it("스크립트는 요청별 nonce로만, 운영에서는 eval 금지", () => {
    expect(prod["script-src"]).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'", "'wasm-unsafe-eval'"]);
    expect(prod["script-src"]).not.toContain("'unsafe-inline'");
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
  });

  it("데이터를 보낼 수 있는 곳은 자기 자신·Supabase·지도 서버뿐", () => {
    expect(prod["connect-src"]).toEqual(["'self'", "https://xyz.supabase.co", "https://tiles.openfreemap.org"]);
    expect(prod["img-src"]).toEqual(["'self'", "data:", "blob:", "https://xyz.supabase.co"]);
  });

  it("프레임 삽입·플러그인·base 변조 차단, HTTPS면 업그레이드", () => {
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["base-uri"]).toEqual(["'self'"]);
    expect(prod["form-action"]).toEqual(["'self'"]);
    expect(prod["upgrade-insecure-requests"]).toEqual([]);
  });

  it("로컬 http에서는 업그레이드하지 않고, 개발 모드만 unsafe-eval", () => {
    const local = parse(buildCsp({ nonce: "n", supabaseUrl: "http://127.0.0.1:54321", dev: true, https: false }));
    expect(local["upgrade-insecure-requests"]).toBeUndefined();
    expect(local["script-src"]).toContain("'unsafe-eval'");
    expect(local["connect-src"]).toContain("http://127.0.0.1:54321");
  });

  it("지도 스타일 주소를 바꾸면 그 출처만 허용, 이상한 값은 무시", () => {
    expect(parse(buildCsp({ nonce: "n", mapStyleUrl: "https://maps.example.com/style.json", dev: false, https: true }))["connect-src"])
      .toEqual(["'self'", "https://maps.example.com"]);
    expect(originOf("javascript:alert(1)")).toBeNull();
    expect(originOf("not a url")).toBeNull();
  });

  it("nonce는 매번 다르고 예측 불가한 길이", () => {
    const a = newNonce();
    expect(a).not.toBe(newNonce());
    expect(atob(a)).toHaveLength(16);
  });
});
