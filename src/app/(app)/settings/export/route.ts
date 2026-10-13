import { NextResponse } from "next/server";
import { createClient, getUserId } from "@/lib/supabase/server";

/**
 * 내 데이터 내보내기: 내가 쓴 기록(현재 커플 + 보관 중인 이전 커플)과 장소, 사진 정보, 내 공개 글.
 * 모든 조회는 내 세션(RLS)으로 하며 author/uploader 조건을 한 번 더 건다. 사진 파일 자체는 포함하지 않는다.
 */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return new NextResponse("로그인이 필요해요.", { status: 401 });
  const supabase = await createClient();

  const [{ data: profile }, { data: memories }, { data: photos }, { data: posts }] = await Promise.all([
    supabase.from("profiles").select("display_name, created_at").eq("id", userId).maybeSingle(),
    supabase
      .from("memories")
      .select("id, title, body, happened_on, tags, share_status, created_at, updated_at, memory_places(seq, name, address, lat, lng, location_source, accuracy_m)")
      .eq("author_id", userId)
      .order("happened_on"),
    supabase
      .from("photos")
      .select("memory_id, taken_at, taken_at_source, lat, lng, location_source, accuracy_m, width, height, created_at")
      .eq("uploader_id", userId),
    supabase.from("public_posts").select("kind, title, body, area, tags, status, created_at").eq("author_id", userId),
  ]);

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      profile,
      memories: memories ?? [],
      photos: { note: "사진 파일은 포함되지 않아요. 기록 화면에서 사진을 열어 저장할 수 있어요.", items: photos ?? [] },
      public_posts: posts ?? [],
    },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dama-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
