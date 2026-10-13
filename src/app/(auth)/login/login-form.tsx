"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { signInInBrowser } from "@/features/auth/client-auth";
import type { FormState } from "@/features/auth/schema";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, action] = useActionState<FormState, FormData>(async (_prev, form) => {
    const result = await signInInBrowser(form);
    if (result.redirectTo) {
      router.replace(result.redirectTo);
      router.refresh();
    }
    return result;
  }, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required
          aria-invalid={Boolean(state.fieldErrors?.email)} />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <div>
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required
          aria-invalid={Boolean(state.fieldErrors?.password)} />
        <FieldError errors={state.fieldErrors?.password} />
      </div>
      <FormMessage error={state.error} />
      <SubmitButton className="w-full" size="lg" pendingText="로그인 중…">로그인</SubmitButton>
    </form>
  );
}
