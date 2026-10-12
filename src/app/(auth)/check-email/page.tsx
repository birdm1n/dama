import Link from "next/link";
import type { Metadata } from "next";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "메일 확인" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const email = (await searchParams).email;
  return (
    <div className="text-center">
      <MailCheck className="mx-auto mb-5 size-10 text-rose-deep" strokeWidth={1.5} />
      <h1 className="font-display text-3xl">메일함을 확인해 주세요</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        {typeof email === "string" ? <b className="text-ink">{email}</b> : "입력한 주소"}로 인증 링크를 보냈어요.
        <br />
        링크를 누르면 가입이 완료돼요.
      </p>
      <p className="mt-6 text-xs text-ink-muted">
        로컬 개발 중이라면 실제 메일 대신 Supabase 메일함(<code>http://127.0.0.1:54324</code>)에서 확인할 수 있어요.
      </p>
      <Link href="/login" className="mt-8 inline-block text-sm underline underline-offset-4">
        로그인으로 돌아가기
      </Link>
    </div>
  );
}
