import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 삭제된 사진(사용자 삭제, 연결 해제 후 영구 삭제)의 파일을 Storage에서 실제로 지운다.
 * 스케줄러(Cloudflare Cron Trigger 등)가 `Authorization: Bearer $CRON_SECRET` 으로 호출한다.
 */
function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || secret.length < 16 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return new NextResponse("unauthorized", { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았어요." }, { status: 500 });

  let removed = 0;
  let failed = 0;
  for (let round = 0; round < 10; round++) {
    const { data, error } = await admin.rpc("claim_storage_deletions", { p_limit: 100 });
    if (error) return NextResponse.json({ error: error.message, removed }, { status: 500 });
    const jobs = (data ?? []) as { id: number; bucket_id: string; path: string }[];
    if (!jobs.length) break;

    const byBucket = new Map<string, typeof jobs>();
    for (const j of jobs) byBucket.set(j.bucket_id, [...(byBucket.get(j.bucket_id) ?? []), j]);
    const done: number[] = [];
    for (const [bucket, list] of byBucket) {
      // 이미 없는 파일을 지우는 것도 성공으로 본다(remove는 없는 경로를 무시한다)
      const { error: rmError } = await admin.storage.from(bucket).remove(list.map((j) => j.path));
      if (rmError) failed += list.length;
      else done.push(...list.map((j) => j.id));
    }
    if (done.length) {
      await admin.rpc("complete_storage_deletions", { p_ids: done });
      removed += done.length;
    }
  }
  return NextResponse.json({ removed, failed });
}
