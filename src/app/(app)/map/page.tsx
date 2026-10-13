import Link from "next/link";
import type { Metadata } from "next";
import { Info, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ScrollCurrentIntoView } from "@/components/layout/scroll-current-into-view";
import { buttonVariants } from "@/components/ui/button";
import { getMyCouple } from "@/features/couple/queries";
import { buildCourses, courseLine, sourceLabel } from "@/features/map/course";
import { MapView, type Pin } from "@/features/map/map-view";
import { getCouplePlaces } from "@/features/map/queries";
import { formatDate } from "@/lib/dates";
import { getUserId } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "지도" };

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const sp = await searchParams;
  const userId = (await getUserId())!;
  const couple = await getMyCouple(userId);
  if (!couple) {
    return (
      <>
        <PageHeader eyebrow="map" title="지도">커플 공간이 있어야 지도를 볼 수 있어요.</PageHeader>
        <Link href="/couple" className={buttonVariants()}>커플 공간으로</Link>
      </>
    );
  }

  const places = await getCouplePlaces(userId, couple.id);
  const courses = buildCourses(places);
  const date = typeof sp.date === "string" ? sp.date : null;
  const course = date ? courses.find((c) => c.date === date) ?? null : null;

  const pins: Pin[] = course
    ? course.places.map((p, i) => ({
        id: p.id, lat: p.lat, lng: p.lng, label: String(i + 1), title: p.name,
        subtitle: `${p.memoryTitle} · ${sourceLabel(p)}`, href: `/memories/${p.memoryId}`, draft: p.shareStatus === "draft",
      }))
    : places.map((p) => ({
        id: p.id, lat: p.lat, lng: p.lng, title: p.name,
        subtitle: `${formatDate(p.happenedOn)} · ${p.memoryTitle}`, href: `/memories/${p.memoryId}`, draft: p.shareStatus === "draft",
      }));
  const line = course ? courseLine(course.places) : null;

  return (
    <>
      <PageHeader eyebrow="map" title="우리의 지도">
        {places.length ? `기록에 남긴 장소 ${places.length}곳` : "기록에 장소를 추가하면 여기에 표시돼요."}
      </PageHeader>

      <ScrollCurrentIntoView label="날짜별 코스" className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
        <Link href="/map" aria-current={!course ? "true" : undefined}
          className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm", !course ? "border-ink bg-ink text-bg" : "border-border bg-surface text-ink-muted")}>
          전체
        </Link>
        {courses.map((c) => (
          <Link key={c.date} href={`/map?date=${c.date}`} aria-current={course?.date === c.date ? "true" : undefined}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm",
              course?.date === c.date ? "border-ink bg-ink text-bg" : "border-border bg-surface text-ink-muted")}>
            {formatDate(c.date)} · {c.places.length}곳
          </Link>
        ))}
      </ScrollCurrentIntoView>

      <MapView pins={pins} line={line} ariaLabel={course ? `${formatDate(course.date)} 코스 지도` : "전체 장소 지도"} />

      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted" data-testid="line-notice">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {course
          ? "점선은 실제로 이동한 경로가 아니라 기록한 순서대로 장소를 이은 선이에요."
          : "날짜를 고르면 그날 기록한 장소를 순서대로 이어서 보여 드려요. 선은 실제 이동 경로가 아니에요."}
        {" "}점선 테두리 핀은 나만 보는 기록의 장소예요.
      </p>

      {course && (
        <section className="mt-8" aria-label="코스 목록">
          <h2 className="mb-3 font-display text-xl">{formatDate(course.date)}</h2>
          <ol className="space-y-2">
            {course.places.map((p, i) => (
              <li key={p.id} data-testid="course-row">
                <Link href={`/memories/${p.memoryId}`} className="card-paper flex items-center gap-3 p-3 hover:bg-beige/25">
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                    p.shareStatus === "draft" ? "border-2 border-dashed border-rose-deep text-rose-deep" : "bg-rose-deep text-white")}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{p.name}</span>
                    <span className="block truncate text-xs text-ink-muted">{p.memoryTitle} · {sourceLabel(p)}</span>
                  </span>
                  {p.shareStatus === "draft" && <Lock className="size-3.5 text-ink-muted" aria-label="나만 보기" />}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
