"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { coupleErrorMessage } from "@/features/couple/errors";
import type { FormState } from "@/features/auth/schema";

/** 권한 확인은 DB 함수(moderate_post)가 운영자 여부를 다시 검사한다 */
export async function moderatePost(_prev: FormState, formData: FormData): Promise<FormState> {
  const postId = String(formData.get("postId") ?? "");
  const decision = formData.get("decision") === "remove" ? "remove" : "restore";
  const note = String(formData.get("note") ?? "").slice(0, 500);
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_post", { p_post_id: postId, p_decision: decision, p_note: note || null });
  if (error) return { error: coupleErrorMessage(error.message) };
  revalidatePath("/admin/reports");
  revalidatePath("/discover");
  // 처리한 글은 대기열에서 빠지므로 결과는 페이지 위에 보여 준다
  redirect(`/admin/reports?done=${decision}`);
}
