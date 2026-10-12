"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { signInSchema, signUpSchema, fieldErrorsOf, type FormState } from "./schema";

async function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: "비밀번호가 너무 약해요. 영문과 숫자를 섞어 8자 이상으로 해 주세요." };
    if (error.code === "over_email_send_rate_limit") return { error: "메일 발송이 잠시 제한됐어요. 조금 뒤 다시 시도해 주세요." };
    return { error: "가입하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  // 이메일 인증이 꺼진 환경이면 바로 세션이 생긴다
  if (data.session) redirect(next);
  // 이미 가입된 이메일인지 여부는 노출하지 않는다(계정 존재 여부 탐색 방지)
  redirect(`/check-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "이메일 인증이 아직 안 됐어요. 받은 메일의 링크를 눌러 주세요." };
    }
    return { error: "이메일 또는 비밀번호가 맞지 않아요." };
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
