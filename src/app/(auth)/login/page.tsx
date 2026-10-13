import Link from "next/link";
import type { Metadata } from "next";
import { InviteTokenStash } from "@/features/couple/invite-gate";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const confirmError = sp.error === "confirm";
  return (
    <>
      <h1 className="font-display text-3xl">다시 만나서 반가워요</h1>
      <p className="mb-8 mt-2 text-sm text-ink-muted">
        {next === "/invite" ? "초대를 수락하려면 먼저 로그인해 주세요." : "로그인하고 우리의 기록을 이어가요."}
      </p>
      {confirmError && (
        <p role="alert" className="mb-5 rounded-md bg-danger/8 px-4 py-3 text-sm text-danger">
          인증 링크가 만료됐거나 올바르지 않아요. 다시 로그인하거나 가입해 주세요.
        </p>
      )}
      {next === "/invite" && <InviteTokenStash />}
      <LoginForm next={next} />
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="text-ink-muted underline underline-offset-4">비밀번호를 잊었어요</Link>
      </p>
      <p className="mt-6 text-center text-sm text-ink-muted">
        처음이신가요?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-ink underline underline-offset-4">
          회원가입
        </Link>
      </p>
    </>
  );
}
