import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/discover", label: "둘러보기" },
  { href: "/discover/saved", label: "저장한 글" },
  { href: "/discover/mine", label: "내 공개 글" },
] as const;

export function DiscoverNav({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="발견 메뉴" className="mb-6 flex gap-2">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={current === t.href ? "page" : undefined}
          className={cn("rounded-full border px-3 py-1.5 text-sm", current === t.href ? "border-ink bg-ink text-bg" : "border-border bg-surface text-ink-muted")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
