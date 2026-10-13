"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { getInvitePreview, getMyCouple } from "./queries";
import { coupleSchema, fieldErrorsOf, type FormState } from "@/features/auth/schema";
import { coupleErrorMessage } from "./errors";

/*
 * 모든 커플 상태 변경은 DB 함수(RPC)로 위임한다.
 * 권한 검증은 DB가 auth.uid() 기준으로 다시 하므로, 여기서 넘기는 값은 신뢰 대상이 아니다.
 */

export async function createCouple(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = coupleSchema.safeParse({
    name: formData.get("name") ?? undefined,
    anniversaryOn: formData.get("anniversaryOn") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_couple", {
    p_name: parsed.data.name || undefined,
    p_anniversary_on: parsed.data.anniversaryOn || undefined,
  });
  if (error) return { error: coupleErrorMessage(error.message) };
  revalidatePath("/", "layout");
  redirect("/couple");
}

export type InviteState = FormState & { token?: string; expiresAt?: string };

export async function createInvite(): Promise<InviteState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite").single<{ token: string; expires_at: string }>();
  if (error || !data) return { error: coupleErrorMessage(error?.message) };
  revalidatePath("/couple");
  // 토큰 원문은 이 응답에서 한 번만 전달된다(DB에는 해시만 저장).
  return { token: data.token, expiresAt: data.expires_at };
}

export async function revokeInvite(formData: FormData) {
  const id = String(formData.get("inviteId") ?? "");
  const supabase = await createClient();
  await supabase.rpc("revoke_invite", { p_invite_id: id });
  revalidatePath("/couple");
}

/** 초대 화면용. 토큰은 POST 본문으로만 받는다(URL·로그에 남지 않게). */
export async function loadInvite(token: string) {
  const userId = await getUserId();
  if (!userId || typeof token !== "string" || token.length > 200) {
    return { preview: { status: "invalid" as const, inviterName: null, coupleName: null, expiresAt: null }, hasCouple: false };
  }
  const [preview, myCouple] = await Promise.all([getInvitePreview(token), getMyCouple(userId)]);
  return { preview, hasCouple: Boolean(myCouple) };
}

export async function acceptInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) return { error: coupleErrorMessage(error.message) };
  revalidatePath("/", "layout");
  redirect("/couple?joined=1");
}

export async function updateCouple(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = coupleSchema.safeParse({
    name: formData.get("name") ?? undefined,
    anniversaryOn: formData.get("anniversaryOn") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const coupleId = String(formData.get("coupleId") ?? "");
  const supabase = await createClient();
  // RLS가 활성 멤버만 수정 가능하도록 막는다. 0행이면 권한 없음.
  const { data, error } = await supabase
    .from("couples")
    .update({ name: parsed.data.name || null, anniversary_on: parsed.data.anniversaryOn || null })
    .eq("id", coupleId)
    .select("id");
  if (error || !data?.length) return { error: "저장하지 못했어요." };
  revalidatePath("/", "layout");
  return { message: "저장했어요." };
}

export async function leaveCouple(_prev: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("confirm") !== "연결 해제") {
    return { error: "확인 문구를 정확히 입력해 주세요." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_couple");
  if (error) return { error: coupleErrorMessage(error.message) };
  revalidatePath("/", "layout");
  redirect("/couple?left=1");
}
