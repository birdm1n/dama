import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/** 로그인이 필요한 경로 접두사. 실제 권한 검증은 DB(RLS)와 서버 코드가 다시 한다. */
const PROTECTED_PREFIXES = ["/home", "/couple", "/memories", "/map", "/discover", "/invite"];

export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
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
    return redirect;
  }

  return response;
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
