import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Lock, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/input";
import { getMyCouple } from "@/features/couple/queries";
import { DeleteMemory, ShareToggle } from "@/features/memories/memory-controls";
import { getMemory } from "@/features/memories/queries";
import { formatDate } from "@/lib/dates";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "기록" };

export default async function MemoryPage({ params, searchParams }: PageProps<"/memories/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const userId = (await getUserId())!;
  const [memory, couple] = await Promise.all([getMemory(userId, id), getMyCouple(userId)]);
  // 권한이 없는 기록은 "없는 기록"과 구별하지 않는다.
  if (!memory) notFound();
  const archived = memory.couple_id !== couple?.id;
  const partner = couple?.members.find((m) => !m.isMe);

  return (
    <article className="mx-auto max-w-2xl">
      <Link href={archived ? "/couple/archive" : "/memories"} className="mb-6 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {archived ? "보관함" : "기록"}
      </Link>
      {sp.saved && <div className="mb-4"><FormMessage message="저장했어요." /></div>}

      <div className="card-paper p-6 md:p-10">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <time dateTime={memory.happened_on}>{formatDate(memory.happened_on)}</time>
          <span aria-hidden>·</span>
          <span>{memory.authorName}</span>
          {memory.share_status === "draft" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-beige px-2 py-0.5 text-xs">
              <Lock className="size-3" /> 나만 보기
            </span>
          ) : (
            <span className="rounded-full bg-rose/25 px-2 py-0.5 text-xs text-ink">함께 보는 기록</span>
          )}
          {archived && <span className="rounded-full bg-beige px-2 py-0.5 text-xs">보관 중 · 읽기 전용</span>}
        </div>
        <h1 className="mt-3 font-display text-3xl leading-tight">{memory.title}</h1>
        {memory.body && <div className="mt-6 whitespace-pre-wrap text-[15px] leading-[1.9]">{memory.body}</div>}
        {memory.tags.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-1.5">
            {memory.tags.map((t) => (
              <li key={t}>
                <Link href={`/memories?tag=${encodeURIComponent(t)}`} className="rounded-full bg-sage/20 px-2.5 py-1 text-xs text-sage-deep">
                  #{t}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {memory.isMine && !archived && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href={`/memories/${memory.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Pencil /> 수정
          </Link>
          <ShareToggle id={memory.id} status={memory.share_status} partnerName={partner?.displayName ?? null} />
          <DeleteMemory id={memory.id} />
        </div>
      )}
      {!memory.isMine && (
        <p className="mt-5 text-xs text-ink-muted">{memory.authorName}님이 공유한 기록이에요. 작성자만 수정할 수 있어요.</p>
      )}
    </article>
  );
}
