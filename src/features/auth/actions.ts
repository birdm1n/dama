"use server";

// 로그인·가입은 브라우저에서 한다(client-auth.ts 참고). 로그아웃만 서버에서.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
