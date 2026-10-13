"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { signUpInBrowser } from "@/features/auth/client-auth";
import type { FormState } from "@/features/auth/schema";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function SignUpForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, action] = useActionState<FormState, FormData>(async (_prev, form) => {
    const result = await signUpInBrowser(form);
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
        <Label htmlFor="displayName">이름</Label>
        <Input id="displayName" name="displayName" autoComplete="nickname" maxLength={30} required
          placeholder="상대에게 보일 이름" aria-invalid={Boolean(state.fieldErrors?.displayName)} />
        <FieldError errors={state.fieldErrors?.displayName} />
      </div>
      <div>
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required
          aria-invalid={Boolean(state.fieldErrors?.email)} />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <div>
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
          aria-describedby="password-hint" aria-invalid={Boolean(state.fieldErrors?.password)} />
        <p id="password-hint" className="mt-1.5 text-xs text-ink-muted">영문과 숫자를 포함해 8자 이상</p>
        <FieldError errors={state.fieldErrors?.password} />
      </div>
      <FormMessage error={state.error} />
      <SubmitButton className="w-full" size="lg" pendingText="가입 중…">가입하기</SubmitButton>
    </form>
  );
}
