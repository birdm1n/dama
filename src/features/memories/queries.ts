import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemoryFilter } from "./schema";
import type { Memory, MemoryRow } from "./types";

export const PAGE_SIZE = 30;

async function withAuthors(rows: MemoryRow[], userId: string): Promise<Memory[]> {
  const ids = [...new Set(rows.map((r) => r.author_id))];
  if (!ids.length) return [];
  const supabase = await createClient();
  // RLS상 나와 현재 상대의 프로필만 읽힌다. 해제 후엔 상대 이름이 안 보이는 게 맞다.
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  const names = new Map((data ?? []).map((p) => [p.id, p.display_name as string]));
  return rows.map((r) => ({
    ...r,
    tags: r.tags ?? [],
    isMine: r.author_id === userId,
    authorName: r.author_id === userId ? "나" : (names.get(r.author_id) ?? "상대"),
  }));
}

/** 현재 활성 커플의 기록 검색. RLS가 "내가 볼 수 있는 것"만 돌려준다. */
export async function searchMemories(userId: string, f: MemoryFilter) {
  const supabase = await createClient();
  const page = f.page ?? 1;
  const { data, error } = await supabase.rpc("search_memories", {
    p_query: f.q,
    p_tag: f.tag,
    p_from: f.from,
    p_to: f.to,
    p_scope: f.scope ?? "all",
    p_limit: PAGE_SIZE + 1,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error("기록을 불러오지 못했어요.");
  const rows = (data ?? []) as MemoryRow[];
  return { items: await withAuthors(rows.slice(0, PAGE_SIZE), userId), hasMore: rows.length > PAGE_SIZE, page };
}

export async function getMemoryTags() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_memory_tags");
  return ((data ?? []) as { tag: string; uses: number }[]).map((t) => t.tag);
}

/** 단건 조회. 볼 권한이 없으면 존재 여부와 상관없이 null (RLS) */
export async function getMemory(userId: string, id: string): Promise<Memory | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("memories").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const [m] = await withAuthors([data as MemoryRow], userId);
  return m;
}

/** 해제된(보관 중) 커플에서 내가 쓴 기록. RLS가 본인 작성분만 허용한다. */
export async function getArchivedMemories(userId: string, coupleId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memories")
    .select("*")
    .eq("couple_id", coupleId)
    .order("happened_on", { ascending: false });
  return withAuthors((data ?? []) as MemoryRow[], userId);
}
