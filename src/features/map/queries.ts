import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MapPlace } from "./course";

type Row = {
  id: string;
  memory_id: string;
  seq: number;
  name: string;
  address: string | null;
  lat: number | string;
  lng: number | string;
  location_source: MapPlace["locationSource"];
  accuracy_m: number | string | null;
  memories: { title: string; happened_on: string; share_status: MapPlace["shareStatus"]; author_id: string; created_at: string };
};

function toPlace(r: Row, userId: string): MapPlace {
  return {
    id: r.id,
    memoryId: r.memory_id,
    memoryTitle: r.memories.title,
    memoryCreatedAt: r.memories.created_at,
    happenedOn: r.memories.happened_on,
    shareStatus: r.memories.share_status,
    isMine: r.memories.author_id === userId,
    seq: r.seq,
    name: r.name,
    address: r.address,
    lat: Number(r.lat),
    lng: Number(r.lng),
    locationSource: r.location_source,
    accuracyM: r.accuracy_m == null ? null : Number(r.accuracy_m),
  };
}

const SELECT =
  "id, memory_id, seq, name, address, lat, lng, location_source, accuracy_m, memories!inner(title, happened_on, share_status, author_id, created_at)";

/** 현재 커플에서 내가 볼 수 있는 기록의 장소 전부. RLS가 기록 가시성을 그대로 적용한다. */
export async function getCouplePlaces(userId: string, coupleId: string): Promise<MapPlace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("memory_places").select(SELECT).eq("couple_id", coupleId).limit(2000);
  if (error) throw new Error("장소를 불러오지 못했어요.");
  return ((data ?? []) as unknown as Row[]).map((r) => toPlace(r, userId));
}

export async function getMemoryPlaces(userId: string, memoryId: string): Promise<MapPlace[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memory_places")
    .select(SELECT)
    .eq("memory_id", memoryId)
    .order("seq")
    .order("id");
  return ((data ?? []) as unknown as Row[]).map((r) => toPlace(r, userId));
}
