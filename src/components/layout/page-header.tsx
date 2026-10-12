import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8">
      {eyebrow && <p className="mb-2 text-xs uppercase tracking-[0.18em] text-rose-deep">{eyebrow}</p>}
      <h1 className="font-display text-3xl leading-tight text-ink md:text-4xl">{title}</h1>
      {children && <div className="mt-3 text-[15px] leading-relaxed text-ink-muted">{children}</div>}
    </header>
  );
}

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="card-paper flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 rounded-full bg-beige px-3 py-1 text-xs text-ink-muted">준비 중</span>
      <h2 className="font-display text-xl">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
    </div>
  );
}
