import Link from "next/link";
import type { Metadata } from "next";
import { safeNextPath } from "@/lib/safe-redirect";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const next = safeNextPath((await searchParams).next);
  return (
    <>
      <h1 className="font-display text-3xl">우리만의 공간 만들기</h1>
      <p className="mb-8 mt-2 text-sm leading-relaxed text-ink-muted">
        가입 후 커플 공간을 만들고 상대를 초대할 수 있어요. 기록은 두 사람만 볼 수 있고, 공개는 항상 직접 선택할 때만 돼요.
      </p>
      <SignUpForm next={next} />
      <p className="mt-6 text-center text-sm text-ink-muted">
        이미 계정이 있나요?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-ink underline underline-offset-4">
          로그인
        </Link>
      </p>
    </>
  );
}
