import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("card-paper p-6", className)} {...props} />;
}

/** 폴라로이드 느낌의 카드: 하단 여백이 넓다 */
export function PolaroidCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("card-paper p-3 pb-8", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("font-display text-xl text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mt-1.5 text-sm leading-relaxed text-ink-muted", className)} {...props} />;
}
