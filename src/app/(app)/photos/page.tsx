import Link from "next/link";
import type { Metadata } from "next";
import { ImagePlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/input";
import { getMyCouple } from "@/features/couple/queries";
import { deletePhoto } from "@/features/photos/actions";
import { getMyPhotos } from "@/features/photos/queries";
import { getUserId } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "내 사진" };

export default async function PhotosPage({ searchParams }: PageProps<"/photos">) {
  const sp = await searchParams;
  const userId = (await getUserId())!;
  const couple = await getMyCouple(userId);
  if (!couple) {
    return (
      <>
        <PageHeader title="내 사진">커플 공간이 있어야 사진을 올릴 수 있어요.</PageHeader>
        <Link href="/couple" className={buttonVariants()}>커플 공간으로</Link>
      </>
    );
  }
  const unattachedOnly = sp.filter === "loose";
  const photos = await getMyPhotos(userId, couple.id, { unattachedOnly });

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader eyebrow="photos" title="내 사진">
          내가 올린 사진이에요. 공유한 기록에 붙은 사진만 상대가 볼 수 있어요.
        </PageHeader>
        <Link href="/photos/upload" className={buttonVariants({ className: "shrink-0" })}>
          <ImagePlus /> 올리기
        </Link>
      </div>
      {sp.uploaded && <div className="mb-6"><FormMessage message={`사진 ${sp.uploaded}장을 저장했어요.`} /></div>}
      <div className="mb-6 flex gap-2 text-sm">
        {[["all", "전체"], ["loose", "기록에 안 붙은 사진"]].map(([v, label]) => {
          const active = (v === "loose") === unattachedOnly;
          return (
            <Link key={v} href={v === "loose" ? "/photos?filter=loose" : "/photos"}
              className={cn("rounded-full border px-3 py-1.5", active ? "border-ink bg-ink text-bg" : "border-border bg-surface text-ink-muted")}>
              {label}
            </Link>
          );
        })}
      </div>
      {photos.length === 0 ? (
        <p className="card-paper px-6 py-12 text-center text-sm text-ink-muted">아직 사진이 없어요.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((p) => (
            <li key={p.id} className="group relative">
              <Link href={p.memoryId ? `/memories/${p.memoryId}` : "#"} aria-label={p.memoryId ? "연결된 기록 보기" : "기록에 안 붙은 사진"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbUrl ?? ""} alt="" loading="lazy" className="aspect-square w-full rounded-sm bg-beige object-cover" />
              </Link>
              {!p.memoryId && <span className="absolute left-1 top-1 rounded-full bg-surface/90 px-1.5 text-[10px] text-ink-muted">미분류</span>}
              <form action={deletePhoto} className="absolute right-1 top-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <input type="hidden" name="id" value={p.id} />
                <button className="rounded-full bg-surface/90 px-1.5 text-[10px] text-danger" aria-label="사진 삭제">삭제</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
