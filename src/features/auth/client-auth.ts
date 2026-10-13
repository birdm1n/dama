"use client";

import { createClient } from "@/lib/supabase/browser";
import { safeNextPath } from "@/lib/safe-redirect";
import { fieldErrorsOf, signInSchema, signUpSchema, type FormState } from "./schema";

/*
 * 로그인·가입은 브라우저에서 Supabase Auth를 직접 호출한다.
 * Supabase Auth의 로그인·가입 횟수 제한은 IP 단위다. 서버(워커)에서 호출하면 모든 사용자가
 * 워커 IP 하나의 제한을 나눠 쓰게 되어 몰릴 때 전원이 로그인하지 못한다.
 * 비밀번호 규칙·이메일 인증 등 실제 검증은 Supabase Auth가 다시 한다.
 */

export async function signInInBrowser(form: FormData): Promise<FormState & { redirectTo?: string }> {
  const parsed = signInSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { error } = await createClient().auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "이메일 인증이 아직 안 됐어요. 받은 메일의 링크를 눌러 주세요." };
    if (error.code === "over_request_rate_limit") return { error: "시도가 너무 많아요. 잠시 후 다시 시도해 주세요." };
    return { error: "이메일 또는 비밀번호가 맞지 않아요." };
  }
  return { redirectTo: safeNextPath(form.get("next")) };
}

export async function signUpInBrowser(form: FormData): Promise<FormState & { redirectTo?: string }> {
  const parsed = signUpSchema.safeParse({
    displayName: form.get("displayName"),
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const next = safeNextPath(form.get("next"));
  const { data, error } = await createClient().auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "비밀번호가 너무 약해요. 영문과 숫자를 섞어 8자 이상으로 해 주세요." };
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return { error: "요청이 잠시 제한됐어요. 조금 뒤 다시 시도해 주세요." };
    }
    return { error: "가입하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  // 이메일 인증이 꺼진 환경이면 바로 세션이 생긴다. 이미 가입된 이메일인지는 드러내지 않는다.
  if (data.session) return { redirectTo: next };
  return { redirectTo: `/check-email?email=${encodeURIComponent(parsed.data.email)}` };
}
