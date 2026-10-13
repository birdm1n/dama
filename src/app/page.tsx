import Link from "next/link";
import { redirect } from "next/navigation";
import { site } from "@/config/site";
import { Logo } from "@/components/layout/logo";
import { buttonVariants } from "@/components/ui/button";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getUserId } from "@/lib/supabase/server";

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const configured = Boolean(getSupabaseEnv());
  if (configured && (await getUserId())) redirect("/home");

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-8">
      <header>
        <Logo />
      </header>
      {sp.deleted && (
        <p role="status" className="mt-6 rounded-md bg-sage/20 px-4 py-3 text-sm text-sage-deep">
          탈퇴가 완료됐어요. 그동안 고마웠어요.
        </p>
      )}

      <section className="flex flex-1 flex-col justify-center gap-12 py-16 md:flex-row md:items-center">
        <div className="max-w-md">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-rose-deep">couple memory</p>
          <h1 className="font-display text-4xl leading-[1.25] md:text-5xl">{site.tagline}</h1>
          <p className="mt-5 leading-relaxed text-ink-muted">
            함께 간 곳, 함께 본 것, 그날의 메모를 둘만의 공간에 차곡차곡. 기록은 기본적으로 두 사람만 볼 수 있어요.
          </p>
          {configured ? (
            <div className="mt-8 flex gap-3">
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                시작하기
              </Link>
              <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
                로그인
              </Link>
            </div>
          ) : (
            <p className="mt-8 rounded-md border border-dashed border-rose-deep/40 bg-surface p-4 text-sm leading-relaxed">
              개발 환경 설정이 아직 안 됐어요. <code>supabase start</code> 후 <code>.env.local</code>에 Supabase URL과
              키를 넣어 주세요. 자세한 방법은 README를 참고하세요.
            </p>
          )}
        </div>

        {/* 스크랩북 느낌의 장식. 실제 사용자 데이터가 아니라 예시임을 표시한다. */}
        <div aria-hidden className="relative mx-auto h-72 w-72 shrink-0 md:h-80 md:w-80">
          <div className="card-paper absolute left-2 top-6 w-44 -rotate-6 p-3 pb-9">
            <div className="aspect-square rounded-sm bg-beige" />
            <p className="mt-3 font-display text-sm text-ink-muted">[예시] 첫 피크닉</p>
          </div>
          <div className="card-paper absolute right-0 top-0 w-44 rotate-3 p-3 pb-9">
            <div className="aspect-square rounded-sm bg-sage/40" />
            <p className="mt-3 font-display text-sm text-ink-muted">[예시] 한강 산책</p>
          </div>
          <div className="card-paper absolute bottom-0 left-16 w-44 rotate-1 p-3 pb-9">
            <div className="aspect-square rounded-sm bg-rose/40" />
            <p className="mt-3 font-display text-sm text-ink-muted">[예시] 비 오는 날 카페</p>
          </div>
        </div>
      </section>
    </main>
  );
}
