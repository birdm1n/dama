import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getArchivedCouples } from "@/features/couple/queries";
import { MemoryCard } from "@/features/memories/memory-card";
import { getArchivedMemories } from "@/features/memories/queries";
import { formatDate } from "@/lib/dates";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "보관함" };

export default async function ArchivePage() {
  const userId = (await getUserId())!;
  const archived = await getArchivedCouples();
  const sections = await Promise.all(archived.map(async (a) => ({ ...a, memories: await getArchivedMemories(userId, a.id) })));

  return (
    <>
      <PageHeader eyebrow="archive" title="보관함">
        연결이 해제된 공간에서 내가 쓴 기록이에요. 읽기만 가능하고, 보관 기간이 지나면 영구 삭제돼요. 필요하면 미리 내보내 두세요.
      </PageHeader>
      {sections.length === 0 && <p className="text-sm text-ink-muted">보관 중인 기록이 없어요.</p>}
      {sections.map((s) => (
        <section key={s.id} className="mb-12">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {formatDate(s.dissolvedAt)} 해제 · <b className="text-danger">{formatDate(s.purgeAfter)}</b>에 영구 삭제 · 내 기록 {s.memories.length}개
            </p>
            <a href={`/couple/archive/${s.id}/export`} className={buttonVariants({ variant: "outline", size: "sm" })} download>
              <Download /> 내 기록 내보내기 (JSON)
            </a>
          </div>
          <div className="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3">
            {s.memories.map((m) => <MemoryCard key={m.id} memory={m} />)}
          </div>
        </section>
      ))}
      <Link href="/couple" className="text-sm underline underline-offset-4">커플 공간으로</Link>
    </>
  );
}
