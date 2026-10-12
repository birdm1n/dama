"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";
import { photoStoragePaths, savePhotosSchema, type SavePhotosInput } from "./schema";

export type SaveResult = { ok: true; memoryIds: string[] } | { ok: false; error: string };

/**
 * 브라우저가 파일을 Storage에 올린 뒤 호출한다. 메타데이터는 사용자가 검토·확인한 값이다.
 * 경로는 서버가 (커플, 사용자, 사진 id)로 다시 계산한다. 권한은 RLS가 최종 확인한다.
 */
export async function savePhotos(input: SavePhotosInput): Promise<SaveResult> {
  const parsed = savePhotosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const supabase = await createClient();
  const { data: couple } = await supabase.from("couples").select("id").eq("status", "active").maybeSingle();
  if (!couple) return { ok: false, error: "커플 공간이 있어야 사진을 올릴 수 있어요." };

  const { photos, groups, memoryId } = parsed.data;

  // 1) 묶음 → 새 기록(항상 '나만 보기'로 만든다. 공유는 기록 화면에서 따로 결정)
  const memoryByGroup = new Map<string, string>();
  if (!memoryId) {
    for (const g of groups) {
      if (g.mode !== "memory") continue;
      const tags: string[] = [];
      const { data, error } = await supabase
        .from("memories")
        .insert({ couple_id: couple.id, author_id: userId, title: g.title, happened_on: g.happenedOn, tags, share_status: "draft" })
        .select("id")
        .single();
      if (error || !data) return { ok: false, error: "기록을 만들지 못했어요." };
      memoryByGroup.set(g.groupId, data.id);
    }
  }

  // 2) 사진 행
  const rows = photos.map((p) => ({
    couple_id: couple.id,
    uploader_id: userId,
    memory_id: memoryId ?? memoryByGroup.get(p.groupId) ?? null,
    ...photoStoragePaths(couple.id, userId, p.id),
    width: p.width,
    height: p.height,
    bytes: p.bytes,
    taken_at: p.takenAt,
    taken_at_source: p.takenAtSource,
    lat: p.lat,
    lng: p.lng,
    location_source: p.locationSource,
    accuracy_m: p.accuracyM,
  }));
  const { error } = await supabase.from("photos").insert(rows);
  if (error) {
    // 방금 만든 기록은 되돌린다
    if (memoryByGroup.size) await supabase.from("memories").delete().in("id", [...memoryByGroup.values()]);
    return { ok: false, error: memoryId ? "이 기록에는 사진을 붙일 수 없어요. 내가 쓴 기록에만 붙일 수 있어요." : "사진 정보를 저장하지 못했어요." };
  }

  revalidatePath("/memories");
  revalidatePath("/photos");
  if (memoryId) revalidatePath(`/memories/${memoryId}`);
  return { ok: true, memoryIds: [...memoryByGroup.values()] };
}

async function removeFiles(paths: string[]) {
  const supabase = await createClient();
  // 실패해도 괜찮다: photos 행이 없으면 파일은 읽을 수 없고, 삭제 대기열이 나중에 정리한다.
  await supabase.storage.from("couple-photos").remove(paths);
}

export async function deletePhoto(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase.from("photos").delete().eq("id", id).select("storage_path, thumb_path, memory_id");
  if (data?.[0]) {
    await removeFiles([data[0].storage_path, data[0].thumb_path]);
    if (data[0].memory_id) revalidatePath(`/memories/${data[0].memory_id}`);
  }
  revalidatePath("/photos");
  revalidatePath("/memories");
}

export async function detachPhoto(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase.from("photos").update({ memory_id: null }).eq("id", id).select("id");
  void data;
  const memoryId = String(formData.get("memoryId") ?? "");
  if (memoryId) revalidatePath(`/memories/${memoryId}`);
  revalidatePath("/photos");
  revalidatePath("/memories");
}

/** 저장 실패 시 브라우저가 올린 파일 정리 (본인 폴더만 지울 수 있다) */
export async function discardUploads(paths: string[]) {
  const userId = await getUserId();
  if (!userId) return;
  const own = paths.filter((p) => p.split("/")[1] === userId).slice(0, 60);
  if (own.length) await removeFiles(own);
}
