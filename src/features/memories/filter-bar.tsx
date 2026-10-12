import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MemoryFilter } from "./schema";

export function memoriesHref(f: MemoryFilter) {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.tag) sp.set("tag", f.tag);
  if (f.scope && f.scope !== "all") sp.set("scope", f.scope);
  if (f.from) sp.set("from", f.from);
  if (f.to) sp.set("to", f.to);
  if (f.page && f.page > 1) sp.set("page", String(f.page));
  const s = sp.toString();
  return s ? `/memories?${s}` : "/memories";
}

const SCOPES = [
  { value: "all", label: "전체" },
  { value: "shared", label: "함께 보는 기록" },
  { value: "draft", label: "나만 보기" },
] as const;

/** JS 없이도 동작하는 GET 폼 */
export function FilterBar({ filter, tags }: { filter: MemoryFilter; tags: string[] }) {
  const hasDate = Boolean(filter.from || filter.to);
  return (
    <div className="mb-8 space-y-4">
      <form action="/memories" role="search" className="space-y-3">
        {filter.tag && <input type="hidden" name="tag" value={filter.tag} />}
        {filter.scope && filter.scope !== "all" && <input type="hidden" name="scope" value={filter.scope} />}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input name="q" type="search" defaultValue={filter.q} placeholder="제목, 메모, 태그 검색" aria-label="기록 검색" className="pl-10" />
        </div>
        <details open={hasDate} className="text-sm">
          <summary className="cursor-pointer text-ink-muted">기간으로 찾기</summary>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input name="from" type="date" defaultValue={filter.from} aria-label="시작 날짜" className="w-auto" />
            <span className="text-ink-muted">~</span>
            <Input name="to" type="date" defaultValue={filter.to} aria-label="끝 날짜" className="w-auto" />
            <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>적용</button>
          </div>
        </details>
      </form>

      <div className="flex flex-wrap gap-2" aria-label="공개 범위">
        {SCOPES.map((s) => {
          const active = (filter.scope ?? "all") === s.value;
          return (
            <Link
              key={s.value}
              href={memoriesHref({ ...filter, scope: s.value, page: undefined })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                active ? "border-ink bg-ink text-bg" : "border-border bg-surface text-ink-muted hover:text-ink",
              )}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="태그">
          {tags.map((t) => {
            const active = filter.tag?.toLowerCase() === t.toLowerCase();
            return (
              <Link
                key={t}
                href={memoriesHref({ ...filter, tag: active ? undefined : t, page: undefined })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs transition-colors",
                  active ? "bg-sage-deep text-white" : "bg-sage/20 text-sage-deep hover:bg-sage/35",
                )}
              >
                #{t}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
