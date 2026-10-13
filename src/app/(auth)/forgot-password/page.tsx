import Link from "next/link";
import type { Metadata } from "next";
import { FormMessage } from "@/components/ui/input";
import { ForgotPasswordForm } from "@/features/auth/password-forms";

export const metadata: Metadata = { title: "비밀번호 재설정" };

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl">비밀번호를 잊으셨나요?</h1>
      <p className="mb-8 mt-2 text-sm text-ink-muted">가입한 이메일로 새 비밀번호를 정할 수 있는 링크를 보내 드려요.</p>
      {sp.expired && <div className="mb-5"><FormMessage error="링크가 만료됐거나 이미 사용됐어요. 링크는 요청한 브라우저에서 열어야 해요. 다시 요청해 주세요." /></div>}
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/login" className="text-ink underline underline-offset-4">로그인으로 돌아가기</Link>
      </p>
    </>
  );
}
