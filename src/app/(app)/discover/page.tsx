import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/input";
import { DiscoverNav } from "@/features/discover/discover-nav";
import { PostGrid } from "@/features/discover/post-card";
import { getFeed } from "@/features/discover/queries";
import { getUserId } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "발견" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const sp = await searchParams;
  const userId = (await getUserId())!;
  const q = one(sp.q)?.slice(0, 100);
  const tag = one(sp.tag)?.slice(0, 20);
  const kind = one(sp.kind) === "course" ? "course" : one(sp.kind) === "place" ? "place" : undefined;
  const page = Math.min(Math.max(Number(one(sp.page)) || 1, 1), 100);
  const { items, hasMore } = await getFeed(userId, { q, tag, kind, page });

  const href = (o: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries({ q, tag, kind, ...o }).filter(([, v]) => v) as [string, string][]);
    return s.size ? `/discover?${s}` : "/discover";
  };

  return (
    <>
      <PageHeader eyebrow="discover" title="다른 커플의 데이트">
        다른 커플이 직접 골라 공개한 장소와 코스예요. 내 기록은 내가 공개하기 전에는 여기에 올라오지 않아요.
      </PageHeader>
      <DiscoverNav current="/discover" />
      {sp.blocked && <div className="mb-4"><FormMessage message="이제 그 작성자의 글이 보이지 않아요." /></div>}

      <form action="/discover" role="search" className="mb-4">
        {kind && <input type="hidden" name="kind" value={kind} />}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input name="q" type="search" defaultValue={q} placeholder="지역, 장소, 분위기 검색" aria-label="공개 글 검색" className="pl-10" />
        </div>
      </form>
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {[[undefined, "전체"], ["course", "코스"], ["place", "장소"]].map(([k, label]) => (
          <Link key={label} href={href({ kind: k, page: undefined })}
            className={cn("rounded-full border px-3 py-1.5", kind === k ? "border-ink bg-ink text-bg" : "border-border bg-surface text-ink-muted")}>
            {label}
          </Link>
        ))}
        {tag && <Link href={href({ tag: undefined })} className="rounded-full bg-sage/20 px-3 py-1.5 text-sage-deep">#{tag} ✕</Link>}
      </div>

      {items.length === 0 ? (
        <p className="card-paper px-6 py-14 text-center text-sm text-ink-muted">
          {q || tag || kind ? "조건에 맞는 공개 글이 없어요." : "아직 공개된 글이 없어요. 내 기록에서 ‘공개 게시물로 만들기’를 눌러 첫 글을 올려 보세요."}
        </p>
      ) : (
        <PostGrid posts={items} />
      )}
      {(page > 1 || hasMore) && (
        <nav className="mt-10 flex justify-center gap-3" aria-label="페이지">
          {page > 1 && <Link href={href({ page: String(page - 1) })} className={buttonVariants({ variant: "outline" })}>이전</Link>}
          {hasMore && <Link href={href({ page: String(page + 1) })} className={buttonVariants({ variant: "outline" })}>더 보기</Link>}
        </nav>
      )}
    </>
  );
}
