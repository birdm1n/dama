import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getMyCouple } from "@/features/couple/queries";
import { PublishForm } from "@/features/discover/publish-form";
import { getMemoryPlaces } from "@/features/map/queries";
import { getMemory } from "@/features/memories/queries";
import { getMemoryPhotos } from "@/features/photos/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "공개 게시물 만들기" };

export default async function NewPostPage({ searchParams }: PageProps<"/discover/new">) {
  const sp = await searchParams;
  const memoryId = typeof sp.memory === "string" ? sp.memory : "";
  const userId = (await getUserId())!;
  const [memory, couple] = await Promise.all([getMemory(userId, memoryId), getMyCouple(userId)]);
  if (!memory || !memory.isMine || memory.couple_id !== couple?.id) notFound();
  const [photos, places] = await Promise.all([getMemoryPhotos(userId, memory.id), getMemoryPlaces(userId, memory.id)]);

  return (
    <>
      <PageHeader eyebrow="publish" title="공개 게시물 만들기">‘{memory.title}’에서 공개할 것만 골라요.</PageHeader>
      <div className="max-w-2xl">
        <PublishForm
          memory={{ id: memory.id, title: memory.title, body: memory.body, tags: memory.tags }}
          photos={photos.filter((p) => p.isMine).map((p) => ({ id: p.id, thumbUrl: p.thumbUrl, hasLocation: p.lat != null }))}
          places={places.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>
    </>
  );
}
