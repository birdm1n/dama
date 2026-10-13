import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/password-forms";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "새 비밀번호" };

export default async function ResetPasswordPage() {
  // 메일 링크(/auth/callback)를 거쳐 세션이 생긴 상태여야 한다
  if (!(await getUserId())) redirect("/forgot-password?expired=1");
  return (
    <>
      <h1 className="font-display text-3xl">새 비밀번호 정하기</h1>
      <p className="mb-8 mt-2 text-sm text-ink-muted">바꾸면 다른 기기에서도 새 비밀번호로 로그인해야 해요.</p>
      <ResetPasswordForm />
    </>
  );
}
