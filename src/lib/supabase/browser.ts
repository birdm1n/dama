"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";
import type { Database } from "./database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** 브라우저 클라이언트(세션 쿠키 공유). 사진 파일 업로드처럼 브라우저에서 직접 Storage로 보낼 때만 쓴다. */
export function createClient() {
  if (!client) {
    const { url, key } = requireSupabaseEnv();
    client = createBrowserClient<Database>(url, key);
  }
  return client;
}
