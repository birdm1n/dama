import { NextResponse } from "next/server";
import { createClient, getUserId } from "@/lib/supabase/server";

/**
 * 보관 중인 이전 커플에서 "내가 쓴" 기록 내보내기.
 * RLS가 보관 기간 내 본인 작성분만 허용하므로 다른 사람 기록은 포함될 수 없다.
 */
export async function GET(_req: Request, ctx: RouteContext<"/couple/archive/[coupleId]/export">) {
  const { coupleId } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return new NextResponse("로그인이 필요해요.", { status: 401 });

  const supabase = await createClient();
  const { data: couple } = await supabase
    .from("couples")
    .select("id, status, dissolved_at, purge_after")
    .eq("id", coupleId)
    .eq("status", "dissolved")
    .maybeSingle();
  if (!couple) return new NextResponse("보관 중인 공간을 찾을 수 없어요.", { status: 404 });

  const { data: memories } = await supabase
    .from("memories")
    .select("title, body, happened_on, tags, share_status, created_at, updated_at")
    .eq("couple_id", coupleId)
    .eq("author_id", userId)
    .order("happened_on");

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      dissolved_at: couple.dissolved_at,
      purge_after: couple.purge_after,
      memories: memories ?? [],
    },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dama-archive-${couple.dissolved_at?.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
