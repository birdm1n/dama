import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * 이메일 인증 링크(PKCE)의 code를 세션으로 교환.
 * 리다이렉트는 상대 경로(Location)로 보낸다. 서버가 아는 origin(localhost 등)과 브라우저가
 * 접속한 host가 다를 때 세션 쿠키가 다른 host에 묶여 로그인이 풀리는 문제를 피하기 위해서다.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return relativeRedirect(next);
  }
  return relativeRedirect("/login?error=confirm");
}

function relativeRedirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}
