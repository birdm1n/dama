"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/browser";
import { z } from "@/lib/zod";
import { fieldErrorsOf, signUpSchema, type FormState } from "./schema";

/**
 * 비밀번호 재설정 요청. 가입 여부와 관계없이 같은 안내를 보여 계정 존재를 드러내지 않는다.
 * 브라우저에서 Supabase Auth를 호출한다(요청 횟수 제한이 IP 단위이므로).
 */
export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(async (_prev, form) => {
    const parsed = z.object({ email: z.string().trim().toLowerCase().email("이메일 형식을 확인해 주세요.") }).safeParse({
      email: form.get("email"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
    const { error } = await createClient().auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
      return { error: "요청이 잠시 제한됐어요. 조금 뒤 다시 시도해 주세요." };
    }
    return { message: "가입된 이메일이라면 비밀번호 재설정 링크를 보냈어요. 메일함을 확인해 주세요." };
  }, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="email">이메일</Label>
        <Input id="email" name="email" type="email" autoComplete="email" />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton className="w-full" size="lg" pendingText="보내는 중…">재설정 링크 받기</SubmitButton>
    </form>
  );
}

const newPasswordSchema = z
  .object({ password: signUpSchema.shape.password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "비밀번호가 서로 달라요." });

/** 메일 링크로 들어온(복구 세션) 사용자가 새 비밀번호를 정한다 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [state, action] = useActionState<FormState, FormData>(async (_prev, form) => {
    const parsed = newPasswordSchema.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
    const { error } = await createClient().auth.updateUser({ password: parsed.data.password });
    if (error) {
      if (error.code === "same_password") return { error: "이전과 다른 비밀번호를 정해 주세요." };
      if (error.code === "weak_password") return { error: "비밀번호가 너무 약해요. 영문과 숫자를 섞어 8자 이상으로 해 주세요." };
      if (error.code === "reauthentication_needed") return { error: "링크가 오래됐어요. 재설정 메일을 다시 받아 주세요." };
      return { error: "비밀번호를 바꾸지 못했어요. 재설정 메일을 다시 받아 주세요." };
    }
    router.replace("/home?password=changed");
    router.refresh();
    return {};
  }, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="password">새 비밀번호</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" aria-describedby="pw-hint" />
        <p id="pw-hint" className="mt-1.5 text-xs text-ink-muted">영문과 숫자를 포함해 8자 이상</p>
        <FieldError errors={fe.password} />
      </div>
      <div>
        <Label htmlFor="confirm">새 비밀번호 확인</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
        <FieldError errors={fe.confirm} />
      </div>
      <FormMessage error={state.error} />
      <SubmitButton className="w-full" size="lg" pendingText="바꾸는 중…">비밀번호 바꾸기</SubmitButton>
    </form>
  );
}
