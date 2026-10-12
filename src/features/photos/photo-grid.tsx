import { MapPin } from "lucide-react";
import type { PhotoView } from "./queries";
import { deletePhoto, detachPhoto } from "./actions";

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(iso));

export function locationLabel(p: Pick<PhotoView, "lat" | "lng" | "locationSource" | "accuracyM">) {
  if (p.lat == null || p.lng == null) return null;
  const src = p.locationSource === "exif" ? "사진 정보" : p.locationSource === "device" ? "기기 위치" : "직접 지정";
  const acc = p.accuracyM != null ? `±${p.accuracyM}m` : "정확도 정보 없음";
  return `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} · ${src} · ${acc}`;
}

/** 기록 상세의 사진들: 폴라로이드 카드 */
export function MemoryPhotoGrid({ photos, editable, memoryId }: { photos: PhotoView[]; editable: boolean; memoryId: string }) {
  if (!photos.length) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {photos.map((p, i) => (
        <li key={p.id} className={`card-paper p-3 pb-4 ${i % 2 ? "sm:rotate-[0.6deg]" : "sm:-rotate-[0.6deg]"}`}>
          {p.url ? (
            <a href={p.url} target="_blank" rel="noreferrer">
              {/* 서명 URL이라 next/image 최적화 대상이 아니다 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" width={p.width} height={p.height} loading="lazy" className="aspect-[4/3] w-full rounded-sm bg-beige object-cover" />
            </a>
          ) : (
            <div className="grid aspect-[4/3] place-items-center rounded-sm bg-beige text-xs text-ink-muted">이미지를 불러올 수 없어요</div>
          )}
          <div className="mt-2.5 space-y-0.5 px-1 text-xs text-ink-muted">
            {p.takenAt && <p>{fmt(p.takenAt)}{p.takenAtSource === "manual" && " (직접 입력)"}</p>}
            {locationLabel(p) && (
              <p className="flex items-center gap-1"><MapPin className="size-3 text-rose-deep" /> {locationLabel(p)}</p>
            )}
          </div>
          {editable && p.isMine && (
            <div className="mt-2 flex gap-3 px-1 text-xs">
              <form action={detachPhoto}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="memoryId" value={memoryId} />
                <button className="text-ink-muted underline underline-offset-2 hover:text-ink">기록에서 빼기</button>
              </form>
              <form action={deletePhoto}>
                <input type="hidden" name="id" value={p.id} />
                <button className="text-danger underline underline-offset-2">사진 삭제</button>
              </form>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
