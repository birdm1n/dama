import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PhotoView = {
  id: string;
  memoryId: string | null;
  uploaderId: string;
  isMine: boolean;
  width: number;
  height: number;
  takenAt: string | null;
  takenAtSource: "exif" | "manual" | null;
  lat: number | null;
  lng: number | null;
  locationSource: "exif" | "device" | "manual" | null;
  accuracyM: number | null;
  url: string | null;
  thumbUrl: string | null;
};

type Row = {
  id: string;
  memory_id: string | null;
  uploader_id: string;
  width: number;
  height: number;
  taken_at: string | null;
  taken_at_source: PhotoView["takenAtSource"];
  lat: number | string | null;
  lng: number | string | null;
  location_source: PhotoView["locationSource"];
  accuracy_m: number | string | null;
  storage_path: string;
  thumb_path: string;
};

const SIGNED_URL_SECONDS = 60 * 60;
const COLS = "id, memory_id, uploader_id, width, height, taken_at, taken_at_source, lat, lng, location_source, accuracy_m, storage_path, thumb_path";

/** 서명 URL 발급. Storage 정책상 볼 수 없는 파일은 URL이 나오지 않는다. */
async function sign(paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("couple-photos").createSignedUrls(paths, SIGNED_URL_SECONDS);
  return new Map((data ?? []).filter((d) => d.signedUrl && !d.error).map((d) => [d.path!, d.signedUrl]));
}

async function toViews(rows: Row[], userId: string, { full }: { full: boolean }): Promise<PhotoView[]> {
  const urls = await sign(rows.flatMap((r) => (full ? [r.storage_path, r.thumb_path] : [r.thumb_path])));
  const num = (v: number | string | null) => (v == null ? null : Number(v));
  return rows.map((r) => ({
    id: r.id,
    memoryId: r.memory_id,
    uploaderId: r.uploader_id,
    isMine: r.uploader_id === userId,
    width: r.width,
    height: r.height,
    takenAt: r.taken_at,
    takenAtSource: r.taken_at_source,
    lat: num(r.lat),
    lng: num(r.lng),
    locationSource: r.location_source,
    accuracyM: num(r.accuracy_m),
    url: full ? (urls.get(r.storage_path) ?? null) : null,
    thumbUrl: urls.get(r.thumb_path) ?? null,
  }));
}

export async function getMemoryPhotos(userId: string, memoryId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("photos")
    .select(COLS)
    .eq("memory_id", memoryId)
    .order("taken_at", { ascending: true, nullsFirst: false })
    .order("created_at");
  return toViews((data ?? []) as Row[], userId, { full: true });
}

/** 기록 카드용 대표 사진(가장 먼저 찍힌 사진 썸네일) */
export async function getCoverThumbs(userId: string, memoryIds: string[]) {
  if (!memoryIds.length) return new Map<string, PhotoView>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("photos")
    .select(COLS)
    .in("memory_id", memoryIds)
    .order("taken_at", { ascending: true, nullsFirst: false });
  const first = new Map<string, Row>();
  for (const r of (data ?? []) as Row[]) if (r.memory_id && !first.has(r.memory_id)) first.set(r.memory_id, r);
  const views = await toViews([...first.values()], userId, { full: false });
  return new Map(views.map((v) => [v.memoryId!, v]));
}

export async function countMemoryPhotos(memoryId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("photos").select("id, lat").eq("memory_id", memoryId);
  return { total: data?.length ?? 0, withLocation: (data ?? []).filter((p) => p.lat != null).length };
}

/** 내가 올린 사진 (현재 활성 커플) */
export async function getMyPhotos(userId: string, coupleId: string, { unattachedOnly = false } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("photos")
    .select(COLS)
    .eq("couple_id", coupleId)
    .eq("uploader_id", userId)
    .order("taken_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (unattachedOnly) q = q.is("memory_id", null);
  const { data } = await q;
  return toViews((data ?? []) as Row[], userId, { full: false });
}
