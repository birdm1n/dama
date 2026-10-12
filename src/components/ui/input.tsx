import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-border bg-surface px-4 text-[15px] text-ink placeholder:text-ink-muted/70",
        "transition-colors focus:border-rose-deep focus:outline-none aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props} />;
}

export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1.5 text-sm text-danger">{errors[0]}</p>;
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-md bg-danger/8 px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  if (message)
    return (
      <p role="status" className="rounded-md bg-sage/20 px-4 py-3 text-sm text-sage-deep">
        {message}
      </p>
    );
  return null;
}
