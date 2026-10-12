"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { fieldErrorsOf, type FormState } from "@/features/auth/schema";
import { memorySchema, parseTags } from "./schema";

/*
 * 권한은 DB(RLS)가 최종 판단한다:
 *  - insert: author_id = auth.uid() 이고 활성 커플 멤버여야 함
 *  - update/delete: 작성자 본인 + 활성 커플
 * 여기서는 입력 정리와 사용자 친화적인 오류만 담당한다.
 */

function readForm(formData: FormData) {
  const parsed = memorySchema.safeParse({
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    happenedOn: formData.get("happenedOn") ?? "",
    tags: formData.get("tags") ?? "",
    shareStatus: formData.get("shareStatus") ?? undefined,
  });
  if (!parsed.success) return { error: { fieldErrors: fieldErrorsOf(parsed.error) } as FormState };
  const { tags, error } = parseTags(parsed.data.tags);
  if (error) return { error: { fieldErrors: { tags: [error] } } as FormState };
  return {
    values: {
      title: parsed.data.title,
      body: parsed.data.body.replace(/\r\n/g, "\n").trimEnd(),
      happened_on: parsed.data.happenedOn,
      tags,
      share_status: parsed.data.shareStatus,
    },
  };
}

export async function createMemory(_prev: FormState, formData: FormData): Promise<FormState> {
  const { values, error } = readForm(formData);
  if (error) return error;
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: couple } = await supabase.from("couples").select("id").eq("status", "active").maybeSingle();
  if (!couple) return { error: "커플 공간이 있어야 기록을 남길 수 있어요." };

  const { data, error: dbError } = await supabase
    .from("memories")
    .insert({ ...values, couple_id: couple.id, author_id: userId })
    .select("id")
    .single();
  if (dbError || !data) return { error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };

  revalidatePath("/memories");
  redirect(`/memories/${data.id}?saved=1`);
}

export async function updateMemory(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const { values, error } = readForm(formData);
  if (error) return error;
  const supabase = await createClient();
  const { data, error: dbError } = await supabase.from("memories").update(values).eq("id", id).select("id");
  if (dbError || !data?.length) return { error: "저장하지 못했어요. 내가 쓴 기록만 수정할 수 있어요." };
  revalidatePath("/memories");
  redirect(`/memories/${id}?saved=1`);
}

export async function setMemoryShare(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const share = formData.get("shareStatus") === "shared" ? "shared" : "draft";
  const supabase = await createClient();
  await supabase.from("memories").update({ share_status: share }).eq("id", id);
  revalidatePath("/memories");
  revalidatePath(`/memories/${id}`);
}

export async function deleteMemory(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (formData.get("confirm") !== "yes") return { error: "삭제를 확인해 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("memories").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "삭제하지 못했어요. 내가 쓴 기록만 삭제할 수 있어요." };
  revalidatePath("/memories");
  redirect("/memories?deleted=1");
}
