import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PostRow = {
  id: string;
  author_id: string;
  kind: "place" | "course";
  title: string;
  body: string;
  area: string | null;
  tags: string[];
  status: "published" | "hidden" | "under_review";
  like_count: number;
  bookmark_count: number;
  created_at: string;
};

export type PostCard = PostRow & { coverUrl: string | null; isMine: boolean; liked: boolean; bookmarked: boolean };

const SIGNED_URL_SECONDS = 60 * 60;

async function sign(paths: string[]) {
  if (!paths.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("post-images").createSignedUrls(paths, SIGNED_URL_SECONDS);
  return new Map((data ?? []).filter((d) => d.signedUrl && !d.error).map((d) => [d.path!, d.signedUrl]));
}

async function decorate(rows: PostRow[], userId: string): Promise<PostCard[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const ids = rows.map((r) => r.id);
  const [{ data: covers }, { data: likes }, { data: marks }] = await Promise.all([
    supabase.from("public_post_images").select("post_id, storage_path").in("post_id", ids).eq("seq", 0),
    supabase.from("post_likes").select("post_id").in("post_id", ids),
    supabase.from("post_bookmarks").select("post_id").in("post_id", ids),
  ]);
  const coverPath = new Map((covers ?? []).map((c) => [c.post_id, c.storage_path]));
  const urls = await sign([...coverPath.values()]);
  const liked = new Set((likes ?? []).map((l) => l.post_id));
  const marked = new Set((marks ?? []).map((l) => l.post_id));
  return rows.map((r) => ({
    ...r,
    tags: r.tags ?? [],
    isMine: r.author_id === userId,
    coverUrl: coverPath.has(r.id) ? (urls.get(coverPath.get(r.id)!) ?? null) : null,
    liked: liked.has(r.id),
    bookmarked: marked.has(r.id),
  }));
}

export const FEED_PAGE = 24;

export async function getFeed(userId: string, f: { q?: string; kind?: "place" | "course"; tag?: string; page?: number }) {
  const supabase = await createClient();
  const page = f.page ?? 1;
  const { data, error } = await supabase.rpc("search_public_posts", {
    p_query: f.q ?? null,
    p_kind: f.kind ?? null,
    p_tag: f.tag ?? null,
    p_limit: FEED_PAGE + 1,
    p_offset: (page - 1) * FEED_PAGE,
  });
  if (error) throw new Error("게시물을 불러오지 못했어요.");
  const rows = (data ?? []) as PostRow[];
  return { items: await decorate(rows.slice(0, FEED_PAGE), userId), hasMore: rows.length > FEED_PAGE, page };
}

export async function getPost(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("public_posts").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const [card] = await decorate([data as PostRow], userId);
  const [{ data: images }, { data: places }] = await Promise.all([
    supabase.from("public_post_images").select("id, storage_path, width, height").eq("post_id", id).order("seq"),
    supabase.from("public_post_places").select("id, seq, name, lat, lng").eq("post_id", id).order("seq"),
  ]);
  const urls = await sign((images ?? []).map((i) => i.storage_path));
  return {
    ...card,
    images: (images ?? []).map((i) => ({ id: i.id, width: i.width, height: i.height, url: urls.get(i.storage_path) ?? null })),
    places: (places ?? []).map((p) => ({ id: p.id, name: p.name, lat: Number(p.lat), lng: Number(p.lng) })),
  };
}

export async function getMyPosts(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("public_posts").select("*").eq("author_id", userId).order("created_at", { ascending: false });
  return decorate((data ?? []) as PostRow[], userId);
}

export async function getBookmarkedPosts(userId: string) {
  const supabase = await createClient();
  const { data: marks } = await supabase.from("post_bookmarks").select("post_id").order("created_at", { ascending: false }).limit(200);
  const ids = (marks ?? []).map((m) => m.post_id);
  if (!ids.length) return [];
  // RLS: 숨겨졌거나 차단된 글은 빠진다
  const { data } = await supabase.from("public_posts").select("*").in("id", ids);
  const byId = new Map(((data ?? []) as PostRow[]).map((p) => [p.id, p]));
  return decorate(ids.map((id) => byId.get(id)).filter(Boolean) as PostRow[], userId);
}
