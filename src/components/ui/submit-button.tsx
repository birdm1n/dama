"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

export function SubmitButton({ children, pendingText, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? (pendingText ?? "처리 중…") : children}
    </Button>
  );
}
