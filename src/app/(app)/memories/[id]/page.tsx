import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Globe, ImagePlus, Lock, MapPin, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/input";
import { getMyCouple } from "@/features/couple/queries";
import { DeleteMemory, ShareToggle } from "@/features/memories/memory-controls";
import { getMemory } from "@/features/memories/queries";
import { sourceLabel } from "@/features/map/course";
import { getMemoryPlaces } from "@/features/map/queries";
import { MemoryPhotoGrid } from "@/features/photos/photo-grid";
import { getMemoryPhotos } from "@/features/photos/queries";
import { formatDate } from "@/lib/dates";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "기록" };

export default async function MemoryPage({ params, searchParams }: PageProps<"/memories/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const userId = (await getUserId())!;
  const [memory, couple] = await Promise.all([getMemory(userId, id), getMyCouple(userId)]);
  // 권한이 없는 기록은 "없는 기록"과 구별하지 않는다.
  if (!memory) notFound();
  const [photos, places] = await Promise.all([getMemoryPhotos(userId, memory.id), getMemoryPlaces(userId, memory.id)]);
  const withLocation = photos.filter((p) => p.lat != null).length;
  const archived = memory.couple_id !== couple?.id;
  const partner = couple?.members.find((m) => !m.isMe);

  return (
    <article className="mx-auto max-w-2xl">
      <Link href={archived ? "/couple/archive" : "/memories"} className="mb-6 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {archived ? "보관함" : "기록"}
      </Link>
      {sp.saved && <div className="mb-4"><FormMessage message="저장했어요." /></div>}
      {typeof sp.attached === "string" && <div className="mb-4"><FormMessage message={`사진 ${Number(sp.attached) || 0}장을 붙였어요.`} /></div>}

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
        {photos.length > 0 && (
          <div className="mt-6">
            <MemoryPhotoGrid photos={photos} memoryId={memory.id} editable={memory.isMine && !archived} />
          </div>
        )}
        {memory.body && <div className="mt-6 whitespace-pre-wrap text-[15px] leading-[1.9]">{memory.body}</div>}
        {places.length > 0 && (
          <section className="mt-8" aria-label="장소">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium"><MapPin className="size-4 text-rose-deep" /> 장소</h2>
            <ol className="space-y-1 text-sm">
              {places.map((p, i) => (
                <li key={p.id} className="flex gap-2">
                  <span className="text-ink-muted">{i + 1}.</span>
                  <span>{p.name} <span className="text-xs text-ink-muted">· {sourceLabel(p)}</span></span>
                </li>
              ))}
            </ol>
            {!archived && (
              <Link href={`/map?date=${memory.happened_on}`} className="mt-2 inline-block text-xs underline underline-offset-2">이 날의 코스를 지도에서 보기</Link>
            )}
          </section>
        )}
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
          <Link href={`/memories/${memory.id}/places`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <MapPin /> 장소
          </Link>
          <Link href={`/photos/upload?memory=${memory.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ImagePlus /> 사진 추가
          </Link>
          <Link href={`/memories/${memory.id}/attach`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            사진함에서
          </Link>
          <ShareToggle
            id={memory.id}
            status={memory.share_status}
            partnerName={partner?.displayName ?? null}
            photoCount={photos.length}
            locationCount={withLocation}
            placeCount={places.length}
          />
          <DeleteMemory id={memory.id} />
        </div>
      )}
      {memory.isMine && !archived && (
        <p className="mt-4 text-xs text-ink-muted">
          <Link href={`/discover/new?memory=${memory.id}`} className="inline-flex items-center gap-1 underline underline-offset-2">
            <Globe className="size-3.5" /> 공개 게시물로 만들기
          </Link>{" "}
          — 고른 사진·장소만 다른 커플에게 공개돼요. 이 기록 자체는 공개되지 않아요.
        </p>
      )}
      {!memory.isMine && (
        <p className="mt-5 text-xs text-ink-muted">{memory.authorName}님이 공유한 기록이에요. 작성자만 수정할 수 있어요.</p>
      )}
    </article>
  );
}
