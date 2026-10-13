import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";
import type { Database } from "./database.types";

/**
 * service_role 클라이언트 — RLS를 우회하므로 서버 전용 정리 작업에서만 쓴다.
 * 사용자 요청을 처리하는 코드에서는 쓰지 않는다.
 */
export function createAdminClient() {
  const env = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceKey) return null;
  return createClient<Database>(env.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
