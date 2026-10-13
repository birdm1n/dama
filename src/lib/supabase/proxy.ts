import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { buildCsp, newNonce } from "@/lib/security/csp";
import { getSupabaseEnv } from "./env";

/** 로그인이 필요한 경로 접두사. 실제 권한 검증은 DB(RLS)와 서버 코드가 다시 한다. */
const PROTECTED_PREFIXES = ["/home", "/couple", "/memories", "/photos", "/map", "/discover", "/invite", "/admin"];

export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();

  // 요청마다 새 nonce. Next.js가 렌더링 중 요청의 CSP 헤더에서 nonce를 읽어 자기 스크립트에 붙인다.
  const nonce = newNonce();
  const https = browserOrigin(request).startsWith("https://");
  const csp = buildCsp({
    nonce,
    supabaseUrl: env?.url,
    mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
    dev: process.env.NODE_ENV === "development",
    https,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const finish = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    if (https) res.headers.set("Strict-Transport-Security", "max-age=31536000");
    return res;
  };
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  if (!env) return finish(next());

  let response = next();

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // 갱신된 세션 쿠키를 이번 요청의 렌더링에도 전달
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        requestHeaders.set("cookie", request.cookies.toString());
        response = next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // 세션 갱신(만료 토큰 refresh) + 서명 검증
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (!isLoggedIn && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const redirect = NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(pathname + search)}`, browserOrigin(request)),
    );
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return finish(redirect);
  }

  return finish(response);
}

/**
 * 브라우저가 실제로 접속한 origin. request.nextUrl.origin은 서버 바인딩 기준(localhost 등)이라
 * 접속 host(127.0.0.1, 실제 도메인)와 다를 수 있고, 그러면 세션 쿠키가 다른 host에 묶여 로그인이 풀린다.
 */
function browserOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}
