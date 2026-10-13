"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/features/auth/schema";
import { DELETE_CONFIRM_TEXT } from "./constants";

export async function updateDisplayName(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("displayName") ?? "").trim();
  if (name.length < 1 || name.length > 30) return { fieldErrors: { displayName: ["이름은 1~30자로 입력해 주세요."] } };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: "로그인이 필요해요." };
  const { data, error } = await supabase.from("profiles").update({ display_name: name }).eq("id", userId).select("id");
  if (error || !data?.length) return { error: "저장하지 못했어요." };
  revalidatePath("/", "layout");
  return { message: "이름을 바꿨어요." };
}

/**
 * 회원 탈퇴.
 *  1) 세션에서 검증된 사용자 id·이메일만 쓴다(폼 값으로 대상을 정하지 않는다).
 *  2) 비밀번호를 다시 확인한다(세션 탈취만으로는 탈퇴시킬 수 없게).
 *  3) 활성 커플이면 먼저 연결 해제한다 → 상대는 자기 기록을 30일 보관함에서 볼 수 있다.
 *  4) Auth Admin API로 계정을 삭제한다. DB는 ON DELETE CASCADE로 내 기록·사진·장소·공개 글·
 *     좋아요·저장·신고·차단을 지우고, 사진·공개 이미지 파일은 삭제 대기열에 넣는다.
 * service_role은 이 함수와 파일 정리 작업에서만 쓴다.
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  if (String(formData.get("confirm") ?? "").trim() !== DELETE_CONFIRM_TEXT) {
    return { fieldErrors: { confirm: [`‘${DELETE_CONFIRM_TEXT}’라고 입력해 주세요.`] } };
  }
  const password = String(formData.get("password") ?? "");
  if (!password) return { fieldErrors: { password: ["비밀번호를 입력해 주세요."] } };

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const email = claimsData?.claims?.email as string | undefined;
  if (!userId || !email) return { error: "로그인이 필요해요." };

  const env = getSupabaseEnv();
  const admin = createAdminClient();
  if (!env || !admin) return { error: "지금은 탈퇴를 처리할 수 없어요. 잠시 후 다시 시도해 주세요." };

  // 비밀번호 재확인: 세션을 저장하지 않는 별도 클라이언트로
  const verifier = createPlainClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({ email, password });
  if (verifyError || verified.user?.id !== userId) return { fieldErrors: { password: ["비밀번호가 맞지 않아요."] } };

  const { error: leaveError } = await supabase.rpc("leave_couple");
  if (leaveError && !leaveError.message.includes("NOT_IN_COUPLE")) {
    return { error: "커플 연결을 해제하지 못해 탈퇴를 멈췄어요. 잠시 후 다시 시도해 주세요." };
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return { error: "탈퇴를 처리하지 못했어요. 잠시 후 다시 시도해 주세요." };

  // 이 브라우저의 세션 쿠키 정리 (계정은 이미 삭제됨)
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  redirect("/?deleted=1");
}
