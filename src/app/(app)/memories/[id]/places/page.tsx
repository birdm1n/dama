import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getMyCouple } from "@/features/couple/queries";
import { deleteMemoryPlace, moveMemoryPlace } from "@/features/map/actions";
import { sourceLabel } from "@/features/map/course";
import { PlaceEditor } from "@/features/map/place-editor";
import { getMemoryPlaces } from "@/features/map/queries";
import { getMemory } from "@/features/memories/queries";
import { getMemoryPhotos } from "@/features/photos/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "장소" };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(iso));

export default async function MemoryPlacesPage({ params }: PageProps<"/memories/[id]/places">) {
  const { id } = await params;
  const userId = (await getUserId())!;
  const [memory, couple] = await Promise.all([getMemory(userId, id), getMyCouple(userId)]);
  if (!memory || !memory.isMine || memory.couple_id !== couple?.id) notFound();
  const [places, photos] = await Promise.all([getMemoryPlaces(userId, id), getMemoryPhotos(userId, id)]);

  return (
    <>
      <Link href={`/memories/${id}`} className="mb-6 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {memory.title}
      </Link>
      <PageHeader eyebrow="places" title="장소">
        이 기록에 들른 곳을 순서대로 남겨요. 지도에서는 이 순서대로 선을 이어요(실제 이동 경로가 아니에요).
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <PlaceEditor
          memoryId={id}
          existing={places.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, label: String(i + 1), title: p.name, subtitle: sourceLabel(p) }))}
          photoLocations={photos
            .filter((p) => p.lat != null && p.lng != null)
            .map((p, i) => ({ id: p.id, lat: p.lat!, lng: p.lng!, accuracyM: p.accuracyM, label: p.takenAt ? fmt(p.takenAt) : `${i + 1}번째` }))}
        />
        <section aria-label="장소 순서">
          <h2 className="mb-3 font-display text-lg">순서</h2>
          {places.length === 0 ? (
            <p className="text-sm text-ink-muted">아직 장소가 없어요.</p>
          ) : (
            <ol className="space-y-2">
              {places.map((p, i) => (
                <li key={p.id} className="card-paper flex items-center gap-3 p-3" data-testid="place-row">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-rose-deep text-xs font-bold text-white">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{p.name}</span>
                    <span className="block text-xs text-ink-muted">{sourceLabel(p)}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    {(["up", "down"] as const).map((dir) => (
                      <form key={dir} action={moveMemoryPlace}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="memoryId" value={id} />
                        <input type="hidden" name="dir" value={dir} />
                        <button className="rounded-full p-1.5 text-ink-muted hover:bg-beige disabled:opacity-30"
                          disabled={dir === "up" ? i === 0 : i === places.length - 1}
                          aria-label={`${p.name} ${dir === "up" ? "위로" : "아래로"}`}>
                          {dir === "up" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                        </button>
                      </form>
                    ))}
                    <form action={deleteMemoryPlace}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="memoryId" value={id} />
                      <button className="px-1.5 text-xs text-danger underline" aria-label={`${p.name} 삭제`}>삭제</button>
                    </form>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
