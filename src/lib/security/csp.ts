/**
 * Content-Security-Policy. 요청마다 새 nonce를 만들어 proxy에서 붙인다.
 *
 * Supabase 세션 쿠키는 브라우저 클라이언트가 읽어야 해서 httpOnly가 아니다.
 * XSS가 생기면 토큰이 노출되므로, CSP로 (1) 우리가 낸 스크립트만 실행되게 하고
 * (2) 데이터를 보낼 수 있는 곳을 Supabase·지도 서버로 제한한다.
 */
export function originOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

export function buildCsp({
  nonce,
  supabaseUrl,
  mapStyleUrl,
  dev,
  https,
}: {
  nonce: string;
  supabaseUrl?: string | null;
  mapStyleUrl?: string | null;
  dev: boolean;
  https: boolean;
}): string {
  const supabase = originOf(supabaseUrl);
  const map = originOf(mapStyleUrl) ?? "https://tiles.openfreemap.org";
  const connect = ["'self'", supabase, map].filter(Boolean).join(" ");
  const img = ["'self'", "data:", "blob:", supabase].filter(Boolean).join(" ");

  const directives = [
    "default-src 'self'",
    // HEIC 디코더(WebAssembly) 때문에 wasm-unsafe-eval. 개발 모드만 React 디버깅용 unsafe-eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    // 스타일은 스크립트보다 위험이 작고 라이브러리(지도 등)가 인라인 스타일을 쓴다
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img}`,
    "font-src 'self'",
    `connect-src ${connect}`,
    // MapLibre·HEIC 디코더 워커
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (https) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function newNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
