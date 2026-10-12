"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookHeart, Compass, Heart, Home, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/home", label: "홈", icon: Home },
  { href: "/memories", label: "기록", icon: BookHeart },
  { href: "/map", label: "지도", icon: MapPinned },
  { href: "/discover", label: "발견", icon: Compass },
  { href: "/couple", label: "커플", icon: Heart },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** 데스크톱: 헤더 안 가로 메뉴 */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴" className="hidden items-center gap-1 md:flex">
      {NAV_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink",
            isActive(pathname, href) && "bg-beige/70 text-ink",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** 모바일: 하단 탭 바 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] text-ink-muted",
                  active && "text-ink",
                )}
              >
                <Icon className={cn("size-5", active && "text-rose-deep")} strokeWidth={active ? 2.2 : 1.7} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
