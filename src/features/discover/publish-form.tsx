"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { publishPost } from "./actions";

type PhotoOpt = { id: string; thumbUrl: string | null; hasLocation: boolean };
type PlaceOpt = { id: string; name: string };

/**
 * 공개 게시물 만들기. 기본값은 "아무것도 공개하지 않음":
 * 글은 비어 있고(개인 메모를 자동으로 옮기지 않음), 사진·장소는 하나도 선택되지 않은 상태에서 시작한다.
 */
export function PublishForm({
  memory,
  photos,
  places,
}: {
  memory: { id: string; title: string; body: string; tags: string[] };
  photos: PhotoOpt[];
  places: PlaceOpt[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [area, setArea] = useState("");
  const [tags, setTags] = useState("");
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [placeIds, setPlaceIds] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function submit() {
    setError(null);
    setBusy(true);
    const r = await publishPost({
      memoryId: memory.id,
      title,
      body,
      area,
      tags,
      photoIds,
      placeIds: places.filter((p) => placeIds.includes(p.id)).map((p) => p.id),
      confirmed: confirmed as true,
    });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push(`/discover/${r.postId}?published=1`);
  }

  return (
    <div className="space-y-8">
      <div className="card-paper flex gap-3 bg-beige/40 p-4 text-sm leading-relaxed">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sage-deep" />
        <p>
          공개 게시물은 내 기록과 <b>별개의 사본</b>이에요. 아래에서 고른 것만 공개되고, 개인 메모·다른 사진·날짜·상대 정보는
          공개되지 않아요. 작성자는 ‘익명의 커플’로 표시돼요. 공개한 뒤에도 언제든 숨기거나 지울 수 있어요.
        </p>
      </div>

      <section className="space-y-4">
        <div>
          <Label htmlFor="pub-title">제목</Label>
          <Input id="pub-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="다른 커플에게 보일 제목" />
        </div>
        <div>
          <div className="flex items-end justify-between">
            <Label htmlFor="pub-body">소개</Label>
            {memory.body && (
              <button type="button" className="mb-1.5 text-xs underline" onClick={() => setBody(memory.body.slice(0, 3000))}>
                내 메모 가져와서 고치기
              </button>
            )}
          </div>
          <textarea id="pub-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={3000}
            placeholder="어떤 데이트였는지, 추천하는 이유"
            className="w-full rounded-md border border-border bg-surface px-4 py-3 text-[15px] leading-relaxed focus:border-rose-deep focus:outline-none" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pub-area">지역 <span className="font-normal text-ink-muted">(선택)</span></Label>
            <Input id="pub-area" value={area} onChange={(e) => setArea(e.target.value)} maxLength={40} placeholder="예) 성수동" />
          </div>
          <div>
            <Label htmlFor="pub-tags">태그 <span className="font-normal text-ink-muted">(선택)</span></Label>
            <Input id="pub-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="쉼표로 구분" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg">공개할 사진</h2>
        <p className="mb-3 mt-1 text-xs text-ink-muted">내가 올린 이 기록의 사진만 고를 수 있어요. 공개 이미지에는 위치 등 메타데이터가 남지 않아요.</p>
        {photos.length === 0 ? (
          <p className="text-sm text-ink-muted">이 기록에 내가 올린 사진이 없어요.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((p, i) => {
              const on = photoIds.includes(p.id);
              return (
                <li key={p.id}>
                  <label className={cn("relative block cursor-pointer overflow-hidden rounded-sm border-2", on ? "border-rose-deep" : "border-transparent")}>
                    <input type="checkbox" className="absolute left-1.5 top-1.5 z-10 size-4 accent-[var(--color-rose-deep)]" checked={on}
                      onChange={() => toggle(photoIds, setPhotoIds, p.id)} aria-label={`사진 ${i + 1} 공개`} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbUrl ?? ""} alt="" className={cn("aspect-square w-full bg-beige object-cover", !on && "opacity-60")} />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg">공개할 장소</h2>
        <p className="mb-3 mt-1 text-xs text-ink-muted">집·회사처럼 개인적인 장소는 빼 주세요. 고른 장소의 위치는 다른 사람이 지도에서 볼 수 있어요.</p>
        {places.length === 0 ? (
          <p className="text-sm text-ink-muted">이 기록에 장소가 없어요.</p>
        ) : (
          <ul className="space-y-1.5">
            {places.map((p, i) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={placeIds.includes(p.id)} onChange={() => toggle(placeIds, setPlaceIds, p.id)}
                    className="size-4 accent-[var(--color-rose-deep)]" aria-label={`${p.name} 공개`} />
                  <MapPin className="size-3.5 text-rose-deep" /> {i + 1}. {p.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-paper space-y-3 p-5" aria-label="공개 내용 확인">
        <h2 className="font-display text-lg">이렇게 공개돼요</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="publish-summary">
          <li>제목: {title.trim() || <span className="text-ink-muted">(비어 있음)</span>}</li>
          <li>소개: {body.trim() ? `${body.trim().length}자` : "없음"}</li>
          <li>사진: {photoIds.length}장</li>
          <li>장소: {placeIds.length}곳{placeIds.length >= 2 && " (코스로 표시)"}</li>
          <li>작성자: 익명의 커플</li>
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-rose-deep)]" />
          위 내용이 로그인한 다른 사용자에게 공개된다는 것을 확인했어요.
        </label>
        {error && <FormMessage error={error} />}
        <Button size="lg" onClick={submit} disabled={busy || !confirmed || !title.trim()}>
          {busy ? "공개하는 중…" : "공개하기"}
        </Button>
      </section>
    </div>
  );
}
