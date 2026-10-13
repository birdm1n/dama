"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { coupleErrorMessage } from "@/features/couple/errors";
import { fieldErrorsOf, type FormState } from "@/features/auth/schema";

const placeSchema = z
  .object({
    memoryId: z.string().uuid(),
    name: z.string().trim().min(1, "장소 이름을 입력해 주세요.").max(60, "60자 이하로 입력해 주세요."),
    address: z.string().trim().max(200).optional(),
    lat: z.coerce.number({ message: "위치를 골라 주세요." }).min(-90).max(90),
    lng: z.coerce.number({ message: "위치를 골라 주세요." }).min(-180).max(180),
    source: z.enum(["exif", "device", "manual"], { message: "위치를 골라 주세요." }),
    accuracy: z.coerce.number().min(0).max(100_000).optional(),
  })
  .transform((v) => ({ ...v, accuracy: v.source === "manual" ? undefined : v.accuracy }));

export async function addMemoryPlace(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const parsed = placeSchema.safeParse({
    ...raw,
    address: raw.address || undefined,
    accuracy: raw.accuracy === "" || raw.accuracy == null ? undefined : raw.accuracy,
    lat: raw.lat === "" ? undefined : raw.lat,
    lng: raw.lng === "" ? undefined : raw.lng,
  });
  if (!parsed.success) {
    const fe = fieldErrorsOf(parsed.error);
    return { fieldErrors: { ...fe, location: fe.lat ?? fe.lng ?? fe.source } };
  }
  const v = parsed.data;
  const supabase = await createClient();

  // 내가 쓴 활성 커플 기록인지는 RLS가 확인한다. couple_id는 기록에서 가져온다.
  const { data: memory } = await supabase.from("memories").select("id, couple_id").eq("id", v.memoryId).maybeSingle();
  if (!memory) return { error: "기록을 찾을 수 없어요." };
  const { data: last } = await supabase
    .from("memory_places")
    .select("seq")
    .eq("memory_id", v.memoryId)
    .order("seq", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("memory_places").insert({
    memory_id: v.memoryId,
    couple_id: memory.couple_id,
    seq: Math.min((last?.[0]?.seq ?? -1) + 1, 999),
    name: v.name,
    address: v.address ?? null,
    lat: Math.round(v.lat * 1e6) / 1e6,
    lng: Math.round(v.lng * 1e6) / 1e6,
    location_source: v.source,
    accuracy_m: v.accuracy == null ? null : Math.round(v.accuracy * 10) / 10,
  });
  if (error) {
    if (error.message.includes("TOO_MANY_PLACES")) return { error: coupleErrorMessage(error.message) };
    return { error: "장소를 저장하지 못했어요. 내가 쓴 기록에만 장소를 넣을 수 있어요." };
  }
  revalidatePath(`/memories/${v.memoryId}`);
  revalidatePath("/map");
  return { message: "장소를 추가했어요." };
}

export async function deleteMemoryPlace(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const memoryId = String(formData.get("memoryId") ?? "");
  const supabase = await createClient();
  await supabase.from("memory_places").delete().eq("id", id);
  revalidatePath(`/memories/${memoryId}`);
  revalidatePath("/map");
}

export async function moveMemoryPlace(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const memoryId = String(formData.get("memoryId") ?? "");
  const dir = formData.get("dir") === "up" ? -1 : 1;
  const supabase = await createClient();
  await supabase.rpc("move_memory_place", { p_place_id: id, p_direction: dir });
  revalidatePath(`/memories/${memoryId}`);
  revalidatePath("/map");
}
