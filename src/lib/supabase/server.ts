import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

/** 서버 컴포넌트·서버 액션·라우트 핸들러용 클라이언트. 요청마다 새로 만든다. */
export async function createClient() {
  // cookies()를 먼저 호출해 이 경로가 요청 시점(동적)에 렌더링되도록 한다.
  const cookieStore = await cookies();
  const { url, key } = requireSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy.ts가 담당한다.
        }
      },
    },
  });
}

/**
 * 현재 로그인 사용자 id. JWT 서명을 검증하는 getClaims()를 쓴다
 * (쿠키 내용을 그대로 믿는 getSession()은 서버 권한 판단에 쓰지 않는다).
 */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}

/** 운영자 여부. app_metadata는 사용자가 바꿀 수 없다(서버 Auth Admin API로만). DB 함수도 같은 값을 다시 확인한다. */
export async function getIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const meta = data?.claims?.app_metadata as { role?: string } | undefined;
  return meta?.role === "admin";
}
