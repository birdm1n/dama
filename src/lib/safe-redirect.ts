/**
 * 로그인 후 돌아갈 경로(next 파라미터) 검증. 외부 도메인으로의 오픈 리다이렉트를 막는다.
 * 같은 사이트의 절대 경로만 허용한다.
 */
export function safeNextPath(next: unknown, fallback = "/home"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/")) return fallback;
  // "//evil.com", "/\evil.com" 은 브라우저가 외부 호스트로 해석한다
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
