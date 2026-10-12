/**
 * Supabase 공개 설정. URL과 publishable(anon) 키는 RLS가 보호하므로 브라우저에 노출돼도 된다.
 * service_role 키는 이 앱에서 사용하지 않으며 절대 NEXT_PUBLIC_ 으로 두지 않는다.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase 설정이 없습니다. README의 '로컬 실행'을 따라 .env.local에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 넣어 주세요.",
    );
  }
  return env;
}
