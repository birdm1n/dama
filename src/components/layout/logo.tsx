import Link from "next/link";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("font-display text-2xl tracking-tight text-ink", className)}>
      {site.logoText}
      <span className="text-rose-deep">.</span>
    </Link>
  );
}
