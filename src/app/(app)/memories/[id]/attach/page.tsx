import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getMyCouple } from "@/features/couple/queries";
import { getMemory } from "@/features/memories/queries";
import { AttachForm } from "@/features/photos/attach-form";
import { getMyPhotos } from "@/features/photos/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "사진함에서 가져오기" };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(iso));

export default async function AttachPage({ params }: PageProps<"/memories/[id]/attach">) {
  const { id } = await params;
  const userId = (await getUserId())!;
  const [memory, couple] = await Promise.all([getMemory(userId, id), getMyCouple(userId)]);
  if (!memory || !memory.isMine || memory.couple_id !== couple?.id) notFound();
  const photos = await getMyPhotos(userId, couple.id, { unattachedOnly: true });
  const partner = couple.members.find((m) => !m.isMe);

  return (
    <>
      <Link href={`/memories/${id}`} className="mb-6 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {memory.title}
      </Link>
      <PageHeader eyebrow="photos" title="사진함에서 가져오기">기록에 아직 안 붙은 내 사진이에요.</PageHeader>
      {photos.length === 0 ? (
        <p className="text-sm text-ink-muted">기록에 안 붙은 사진이 없어요. <Link href={`/photos/upload?memory=${id}`} className="underline">새로 올리기</Link></p>
      ) : (
        <AttachForm
          memoryId={id}
          shared={memory.share_status === "shared"}
          partnerName={partner?.displayName ?? null}
          photos={photos.map((p) => ({ id: p.id, thumbUrl: p.thumbUrl, label: p.takenAt ? fmt(p.takenAt) : "날짜 없음" }))}
        />
      )}
    </>
  );
}
