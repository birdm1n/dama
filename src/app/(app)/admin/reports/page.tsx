import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { FormMessage } from "@/components/ui/input";
import { ModerateForm } from "@/features/admin/moderate-form";
import { REPORT_REASONS, type ReportReason } from "@/features/discover/schema";
import { formatDateTime } from "@/lib/dates";
import { createClient, getIsAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "신고 검토" };

type QueueRow = {
  post_id: string; title: string; body: string; area: string | null; kind: string; status: string;
  created_at: string; open_reports: number; reasons: ReportReason[] | null; details: string[] | null; last_reported_at: string;
};

const STATUS: Record<string, string> = { published: "공개 중", under_review: "자동 숨김(검토 대기)", removed: "내려짐" };

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const sp = await searchParams;
  if (!(await getIsAdmin())) notFound(); // 운영자 화면이 있다는 사실도 드러내지 않는다
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_report_queue");
  if (error) throw new Error("검토 대기열을 불러오지 못했어요.");
  const rows = (data ?? []) as QueueRow[];

  return (
    <>
      <PageHeader eyebrow="admin" title="신고 검토">
        미처리 신고가 있는 글이에요. 3명 이상 신고한 글은 이미 자동으로 숨겨져 있어요. 처리하면 신고자·작성자 정보는 남지 않고 처리 기록만 남아요.
      </PageHeader>
      {sp.done && (
        <div className="mb-4"><FormMessage message={sp.done === "remove" ? "글을 내렸어요." : "글을 복구했어요."} /></div>
      )}
      {rows.length === 0 ? (
        <p className="card-paper px-6 py-12 text-center text-sm text-ink-muted">처리할 신고가 없어요.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.post_id} className="card-paper grid gap-4 p-5 md:grid-cols-[1fr_18rem]" data-testid="report-item">
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">
                  {STATUS[r.status] ?? r.status} · 신고 {r.open_reports}건 · 최근 {formatDateTime(r.last_reported_at)}
                </p>
                <Link href={`/discover/${r.post_id}`} className="mt-1 block font-display text-lg underline-offset-4 hover:underline">{r.title}</Link>
                {r.body && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-ink-muted">{r.body}</p>}
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {(r.reasons ?? []).map((reason) => (
                    <li key={reason} className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">{REPORT_REASONS[reason] ?? reason}</li>
                  ))}
                </ul>
                {(r.details ?? []).length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {r.details!.slice(0, 5).map((d, i) => <li key={i} className="rounded-sm bg-beige/50 px-2 py-1">“{d}”</li>)}
                  </ul>
                )}
              </div>
              <ModerateForm postId={r.post_id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
