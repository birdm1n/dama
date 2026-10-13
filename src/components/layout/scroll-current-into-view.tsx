"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** 가로 스크롤 목록에서 aria-current 항목이 보이도록 스크롤한다 */
export function ScrollCurrentIntoView({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>("[aria-current]");
    if (el && ref.current) {
      const box = ref.current;
      box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
    }
  });
  return <nav ref={ref} aria-label={label} className={className}>{children}</nav>;
}
