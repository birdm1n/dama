import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/input";
import { getMyCouple } from "@/features/couple/queries";
import { FilterBar, memoriesHref } from "@/features/memories/filter-bar";
import { MemoryCard } from "@/features/memories/memory-card";
import { getMemoryTags, searchMemories } from "@/features/memories/queries";
import { parseFilter } from "@/features/memories/schema";
import type { Memory } from "@/features/memories/types";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "기록" };

function groupByMonth(items: Memory[]) {
  const groups = new Map<string, Memory[]>();
  for (const m of items) {
    const key = m.happened_on.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const [y, mo] = key.split("-");
    return { key, label: `${y}년 ${Number(mo)}월`, list };
  });
}

export default async function MemoriesPage({ searchParams }: PageProps<"/memories">) {
  const sp = await searchParams;
  const userId = (await getUserId())!;
  const couple = await getMyCouple(userId);

  if (!couple) {
    return (
      <>
        <PageHeader eyebrow="memories" title="기록">
          기록은 커플 공간 안에 남겨요. 먼저 커플 공간을 만들거나 받은 초대 링크를 열어 주세요.
        </PageHeader>
        <Link href="/couple" className={buttonVariants()}>커플 공간으로</Link>
      </>
    );
  }

  const filter = parseFilter(sp);
  const [{ items, hasMore, page }, tags] = await Promise.all([searchMemories(userId, filter), getMemoryTags()]);
  const filtering = Boolean(filter.q || filter.tag || filter.from || filter.to || (filter.scope && filter.scope !== "all"));

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow="memories" title="우리의 기록" />
        <Link href="/memories/new" className={buttonVariants({ className: "shrink-0" })}>
          <Plus /> 새 기록
        </Link>
      </div>
      {sp.deleted && <div className="mb-6"><FormMessage message="기록을 삭제했어요." /></div>}

      <FilterBar filter={filter} tags={tags} />

      {items.length === 0 ? (
        <div className="card-paper px-6 py-14 text-center">
          {filtering ? (
            <>
              <p className="font-display text-lg">조건에 맞는 기록이 없어요</p>
              <Link href="/memories" className="mt-3 inline-block text-sm underline underline-offset-4">필터 지우기</Link>
            </>
          ) : (
            <>
              <p className="font-display text-xl">첫 기록을 남겨 볼까요?</p>
              <p className="mt-2 text-sm text-ink-muted">함께 간 곳, 나눈 이야기를 적어 두면 여기 차곡차곡 쌓여요.</p>
              <Link href="/memories/new" className={buttonVariants({ className: "mt-6" })}>기록 쓰기</Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {groupByMonth(items).map((g) => (
            <section key={g.key} aria-labelledby={`m-${g.key}`}>
              <h2 id={`m-${g.key}`} className="mb-4 flex items-center gap-3 font-display text-lg text-ink-muted">
                {g.label}
                <span className="h-px flex-1 bg-border" />
              </h2>
              <div className="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3">
                {g.list.map((m) => <MemoryCard key={m.id} memory={m} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {(page > 1 || hasMore) && (
        <nav className="mt-10 flex justify-center gap-3" aria-label="페이지">
          {page > 1 && (
            <Link href={memoriesHref({ ...filter, page: page - 1 })} className={buttonVariants({ variant: "outline" })}>이전</Link>
          )}
          {hasMore && (
            <Link href={memoriesHref({ ...filter, page: page + 1 })} className={buttonVariants({ variant: "outline" })}>더 보기</Link>
          )}
        </nav>
      )}
    </>
  );
}
