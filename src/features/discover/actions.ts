"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { coupleErrorMessage } from "@/features/couple/errors";
import { parseTags } from "@/features/memories/schema";
import type { FormState } from "@/features/auth/schema";
import { publishSchema, REPORT_REASONS, type PublishInput } from "./schema";
import { stripWebpMetadata } from "./webp-strip";

export type PublishResult = { ok: false; error: string } | { ok: true; postId: string };

/**
 * 내 기록에서 사용자가 고른 글·사진·장소만 복사해 공개 게시물을 만든다.
 * 모든 조회·쓰기는 사용자 세션(RLS)으로 한다: 내 기록·내 사진·내 장소만 읽히고, 내 게시물에만 쓸 수 있다.
 */
export async function publishPost(input: PublishInput): Promise<PublishResult> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  const v = parsed.data;
  const { tags, error: tagError } = parseTags(v.tags);
  if (tagError) return { ok: false, error: tagError };

  const userId = await getUserId();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };
  const supabase = await createClient();

  // 1) 원본 확인: 내가 쓴, 활성 커플의 기록
  const { data: memory } = await supabase
    .from("memories")
    .select("id, author_id, couple_id, couples!inner(status)")
    .eq("id", v.memoryId)
    .maybeSingle();
  const coupleStatus = (memory?.couples as unknown as { status: string } | null)?.status;
  if (!memory || memory.author_id !== userId || coupleStatus !== "active") {
    return { ok: false, error: "내가 쓴 기록만 공개할 수 있어요." };
  }

  // 2) 고른 사진·장소가 정말 이 기록의 것인지 확인 (RLS로 읽히는 것 중에서)
  const [{ data: photos }, { data: places }] = await Promise.all([
    v.photoIds.length
      ? supabase.from("photos").select("id, storage_path, width, height, uploader_id, memory_id").in("id", v.photoIds).eq("memory_id", v.memoryId)
      : Promise.resolve({ data: [] as { id: string; storage_path: string; width: number; height: number; uploader_id: string; memory_id: string }[] }),
    v.placeIds.length
      ? supabase.from("memory_places").select("id, seq, name, lat, lng").in("id", v.placeIds).eq("memory_id", v.memoryId).order("seq").order("id")
      : Promise.resolve({ data: [] as { id: string; seq: number; name: string; lat: number; lng: number }[] }),
  ]);
  const okPhotos = (photos ?? []).filter((p) => p.uploader_id === userId);
  if (okPhotos.length !== v.photoIds.length || (places ?? []).length !== v.placeIds.length) {
    return { ok: false, error: "선택한 사진이나 장소를 찾을 수 없어요. 새로고침 후 다시 시도해 주세요." };
  }

  // 3) 게시물
  const { data: post, error: postError } = await supabase
    .from("public_posts")
    .insert({
      author_id: userId,
      kind: (places ?? []).length >= 2 ? "course" : "place",
      title: v.title,
      body: v.body.replace(/\r\n/g, "\n").trimEnd(),
      area: v.area || null,
      tags,
    })
    .select("id")
    .single();
  if (postError || !post) return { ok: false, error: coupleErrorMessage(postError?.message) };

  const uploaded: string[] = [];
  const fail = async (msg: string): Promise<PublishResult> => {
    await supabase.from("public_posts").delete().eq("id", post.id);
    if (uploaded.length) await supabase.storage.from("post-images").remove(uploaded);
    return { ok: false, error: msg };
  };

  // 4) 장소 사본 (기록 안 순서 유지)
  if (places?.length) {
    const { error } = await supabase.from("public_post_places").insert(
      places.map((p, i) => ({ post_id: post.id, seq: i, name: p.name, lat: Number(p.lat), lng: Number(p.lng) })),
    );
    if (error) return fail("장소를 공개하지 못했어요.");
  }

  // 5) 사진 사본: 비공개 원본 → 메타데이터 제거 → 게시물 폴더
  const ordered = v.photoIds.map((id) => okPhotos.find((p) => p.id === id)!);
  for (const [i, p] of ordered.entries()) {
    const { data: blob, error: dlError } = await supabase.storage.from("couple-photos").download(p.storage_path);
    if (dlError || !blob) return fail("사진을 읽지 못했어요.");
    let clean: Uint8Array;
    try {
      clean = stripWebpMetadata(new Uint8Array(await blob.arrayBuffer()));
    } catch {
      return fail("사진 형식을 확인할 수 없어 공개하지 않았어요.");
    }
    const path = `${post.id}/${randomUUID()}.webp`;
    const { error: upError } = await supabase.storage
      .from("post-images")
      .upload(path, clean, { contentType: "image/webp", upsert: false });
    if (upError) return fail("사진을 공개하지 못했어요.");
    uploaded.push(path);
    const { error } = await supabase
      .from("public_post_images")
      .insert({ post_id: post.id, seq: i, storage_path: path, width: p.width, height: p.height });
    if (error) return fail("사진을 공개하지 못했어요.");
  }

  revalidatePath("/discover");
  return { ok: true, postId: post.id };
}

export async function toggleLike(formData: FormData) {
  await toggle("post_likes", formData);
}
export async function toggleBookmark(formData: FormData) {
  await toggle("post_bookmarks", formData);
}
async function toggle(table: "post_likes" | "post_bookmarks", formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const on = formData.get("on") === "1";
  const userId = await getUserId();
  if (!userId) return;
  const supabase = await createClient();
  if (on) await supabase.from(table).insert({ post_id: postId, user_id: userId });
  else await supabase.from(table).delete().eq("post_id", postId).eq("user_id", userId);
  revalidatePath(`/discover/${postId}`);
  revalidatePath("/discover");
}

export async function reportPost(_prev: FormState, formData: FormData): Promise<FormState> {
  const postId = String(formData.get("postId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const detail = String(formData.get("detail") ?? "").trim().slice(0, 500);
  if (!(reason in REPORT_REASONS)) return { error: "신고 사유를 골라 주세요." };
  const userId = await getUserId();
  if (!userId) return { error: "로그인이 필요해요." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("post_reports")
    .insert({ post_id: postId, reporter_id: userId, reason, detail: detail || null });
  if (error) {
    if (error.code === "23505") return { message: "이미 신고한 글이에요." };
    if (error.message.includes("RATE_LIMITED")) return { error: coupleErrorMessage(error.message) };
    return { error: "신고하지 못했어요." };
  }
  revalidatePath("/discover");
  return { message: "신고를 접수했어요. 여러 사람이 신고한 글은 자동으로 숨겨지고 검토돼요." };
}

/** 작성자 차단: 게시물 id로만 받는다(작성자 id를 화면에 노출하지 않기 위해) */
export async function blockAuthor(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const userId = await getUserId();
  if (!userId) return;
  const supabase = await createClient();
  const { data: post } = await supabase.from("public_posts").select("author_id").eq("id", postId).maybeSingle();
  if (post && post.author_id !== userId) {
    await supabase.from("user_blocks").insert({ blocker_id: userId, blocked_id: post.author_id });
  }
  revalidatePath("/discover");
  redirect("/discover?blocked=1");
}

export async function setPostVisibility(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const status = formData.get("status") === "hidden" ? "hidden" : "published";
  const supabase = await createClient();
  await supabase.from("public_posts").update({ status }).eq("id", postId);
  revalidatePath(`/discover/${postId}`);
  revalidatePath("/discover");
}

export async function deletePost(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const supabase = await createClient();
  const { data: images } = await supabase.from("public_post_images").select("storage_path").eq("post_id", postId);
  const { data } = await supabase.from("public_posts").delete().eq("id", postId).select("id");
  if (data?.length && images?.length) {
    // 실패해도 삭제 대기열이 나중에 정리한다
    await supabase.storage.from("post-images").remove(images.map((i) => i.storage_path));
  }
  revalidatePath("/discover");
  redirect("/discover/mine?deleted=1");
}
