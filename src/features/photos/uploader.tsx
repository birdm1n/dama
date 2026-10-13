"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Info, MapPin, MapPinOff, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { discardUploads, savePhotos } from "./actions";
import { groupPhotos } from "./grouping";
import { processPhoto, UnsupportedImageError } from "./process.client";
import { photoStoragePaths } from "./schema";
import type { PhotoMeta } from "./meta";

type Item = {
  key: string; // 사진 id(uuid) — 저장 경로에도 쓰인다
  name: string;
  status: "processing" | "ready" | "error";
  error?: string;
  previewUrl?: string;
  main?: Blob;
  thumb?: Blob;
  width?: number;
  height?: number;
  exif?: PhotoMeta;
  takenAt: string | null;
  takenAtSource: "exif" | "manual" | null;
  locationRemoved: boolean;
};

type GroupChoice = { mode: "library" | "memory"; title: string; happenedOn: string };

const pad = (n: number) => String(n).padStart(2, "0");
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localDate(iso: string | null) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

function errorText(e: unknown) {
  if (e instanceof UnsupportedImageError) {
    if (e.message === "too-large") return "파일이 너무 커요(40MB 초과).";
    if (e.message === "decode") return "이 사진 형식을 열 수 없어요. JPEG로 내보낸 뒤 다시 올려 주세요.";
  }
  return "사진을 처리하지 못했어요.";
}

export function PhotoUploader({
  coupleId,
  userId,
  memory,
}: {
  coupleId: string;
  userId: string;
  /** 기존 기록에 바로 붙일 때 */
  memory: { id: string; title: string } | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [choices, setChoices] = useState<Record<string, GroupChoice>>({});
  const [phase, setPhase] = useState<"edit" | "uploading">("edit");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => items.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl)), []); // eslint-disable-line react-hooks/exhaustive-deps

  function update(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = 30 - items.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setError("한 번에 30장까지 올릴 수 있어요.");
    const fresh: Item[] = list.map((f) => ({
      key: crypto.randomUUID(),
      name: f.name,
      status: "processing",
      takenAt: null,
      takenAtSource: null,
      locationRemoved: false,
    }));
    setItems((prev) => [...prev, ...fresh]);
    // 순서대로 처리(휴대폰 메모리 보호)
    for (let i = 0; i < list.length; i++) {
      try {
        const p = await processPhoto(list[i]);
        update(fresh[i].key, {
          status: "ready",
          main: p.main,
          thumb: p.thumb,
          width: p.width,
          height: p.height,
          exif: p.meta,
          previewUrl: URL.createObjectURL(p.thumb),
          takenAt: p.meta.takenAt,
          takenAtSource: p.meta.takenAt ? "exif" : null,
        });
      } catch (e) {
        update(fresh[i].key, { status: "error", error: errorText(e) });
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const ready = items.filter((i) => i.status === "ready");
  const groups = groupPhotos(
    ready.map((i) => ({
      ...i,
      lat: i.locationRemoved ? null : (i.exif?.lat ?? null),
      lng: i.locationRemoved ? null : (i.exif?.lng ?? null),
    })),
  );

  const choiceFor = (gid: string, start: string | null): GroupChoice =>
    choices[gid] ?? { mode: "library", title: "", happenedOn: localDate(start) };

  async function upload() {
    setError(null);
    if (!ready.length) return;
    const decisions = memory
      ? []
      : groups.map((g) => {
          const c = choiceFor(g.id, g.start);
          return c.mode === "memory"
            ? { groupId: g.id, mode: "memory" as const, title: c.title.trim(), happenedOn: c.happenedOn }
            : { groupId: g.id, mode: "library" as const };
        });
    if (decisions.some((d) => d.mode === "memory" && !d.title)) {
      setError("새 기록으로 만들 묶음의 제목을 입력해 주세요.");
      return;
    }

    setPhase("uploading");
    setProgress(0);
    const supabase = createClient();
    const uploaded: string[] = [];
    try {
      for (const [n, item] of ready.entries()) {
        const paths = photoStoragePaths(coupleId, userId, item.key);
        for (const [path, blob] of [
          [paths.storage_path, item.main!],
          [paths.thumb_path, item.thumb!],
        ] as const) {
          const { error: upErr } = await supabase.storage
            .from("couple-photos")
            .upload(path, blob, { contentType: "image/webp", upsert: false, cacheControl: "3600" });
          if (upErr) throw new Error("upload");
          uploaded.push(path);
        }
        setProgress(Math.round(((n + 1) / ready.length) * 100));
      }

      const groupOf = new Map(groups.flatMap((g) => g.items.map((i) => [i.key, g.id] as const)));
      const result = await savePhotos({
        memoryId: memory?.id ?? null,
        groups: decisions,
        photos: ready.map((i) => {
          const loc = !i.locationRemoved && i.exif?.lat != null ? i.exif : null;
          return {
            id: i.key,
            width: i.width!,
            height: i.height!,
            bytes: i.main!.size,
            takenAt: i.takenAt,
            takenAtSource: i.takenAt ? i.takenAtSource : null,
            lat: loc?.lat ?? null,
            lng: loc?.lng ?? null,
            locationSource: loc ? ("exif" as const) : null,
            accuracyM: loc?.accuracyM ?? null,
            groupId: groupOf.get(i.key) ?? "g-untimed",
          };
        }),
      });
      if (!result.ok) throw new Error(result.error);

      if (memory) router.push(`/memories/${memory.id}?saved=1`);
      else if (result.memoryIds.length === 1) router.push(`/memories/${result.memoryIds[0]}?saved=1`);
      else router.push(`/photos?uploaded=${ready.length}`);
      router.refresh();
    } catch (e) {
      await discardUploads(uploaded).catch(() => {});
      setPhase("edit");
      setError(e instanceof Error && e.message !== "upload" ? e.message : "업로드하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    }
  }

  const busy = phase === "uploading";
  const processing = items.some((i) => i.status === "processing");

  return (
    <div className="space-y-8">
      <div className="card-paper p-6">
        <input
          ref={inputRef}
          id="photo-input"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
          disabled={busy}
        />
        <label
          htmlFor="photo-input"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-rose-deep/50 bg-bg px-4 py-10 text-center transition-colors hover:bg-rose/10"
        >
          <ImagePlus className="size-8 text-rose-deep" strokeWidth={1.5} />
          <span className="font-medium">사진 고르기</span>
          <span className="text-xs text-ink-muted">한 번에 30장까지</span>
        </label>
        <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-ink-muted">
          <li className="flex gap-1.5"><Info className="mt-0.5 size-3.5 shrink-0" /> 브라우저는 새로 찍은 사진을 자동으로 알 수 없어요. 올릴 사진을 직접 골라 주세요.</li>
          <li className="flex gap-1.5"><Info className="mt-0.5 size-3.5 shrink-0" /> 촬영 시각·위치는 사진 정보(EXIF)에서 읽어요. 저장 전에 확인하고 고치거나 뺄 수 있어요.</li>
          <li className="flex gap-1.5"><Info className="mt-0.5 size-3.5 shrink-0" /> 저장되는 사진 파일은 다시 만들어져서 원본의 위치 정보가 파일에 남지 않아요.</li>
          <li className="flex gap-1.5"><Info className="mt-0.5 size-3.5 shrink-0" /> 올린 사진은 나만 볼 수 있어요. 공유한 기록에 붙은 사진만 상대가 볼 수 있어요.</li>
        </ul>
      </div>

      {items.length > 0 && (
        <section aria-label="사진 확인">
          <h2 className="mb-3 font-display text-xl">시각과 위치를 확인해 주세요</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((i) => (
              <li key={i.key} className="card-paper flex gap-3 p-3" data-testid="photo-item">
                <div className="size-24 shrink-0 overflow-hidden rounded-sm bg-beige">
                  {i.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.previewUrl} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs text-ink-muted">{i.name}</p>
                    <button type="button" onClick={() => setItems((p) => p.filter((x) => x.key !== i.key))}
                      className="text-ink-muted hover:text-ink" aria-label={`${i.name} 빼기`} disabled={busy}>
                      <X className="size-4" />
                    </button>
                  </div>
                  {i.status === "processing" && <p className="text-ink-muted">읽는 중…</p>}
                  {i.status === "error" && <p className="text-danger">{i.error}</p>}
                  {i.status === "ready" && (
                    <>
                      <div>
                        <label className="sr-only" htmlFor={`t-${i.key}`}>촬영 시각</label>
                        <input
                          id={`t-${i.key}`}
                          type="datetime-local"
                          value={toLocalInput(i.takenAt)}
                          disabled={busy}
                          onChange={(e) =>
                            update(i.key, {
                              takenAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                              takenAtSource: e.target.value ? "manual" : null,
                            })
                          }
                          className="w-full rounded-sm border border-border bg-surface px-2 py-1 text-sm"
                        />
                        <p className="mt-0.5 text-xs text-ink-muted" data-testid="time-source">
                          {i.takenAtSource === "exif"
                            ? i.exif?.takenAtAssumedTimezone
                              ? "사진 정보 기준 · 시간대 정보가 없어 이 기기 시간대로 추정"
                              : "사진 정보 기준"
                            : i.takenAtSource === "manual"
                              ? "직접 입력"
                              : "시각 정보 없음 — 직접 입력할 수 있어요"}
                        </p>
                      </div>
                      {i.exif?.lat != null ? (
                        i.locationRemoved ? (
                          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                            <MapPinOff className="size-3.5" /> 위치를 저장하지 않아요
                            <button type="button" className="ml-auto inline-flex items-center gap-1 underline" onClick={() => update(i.key, { locationRemoved: false })}>
                              <Undo2 className="size-3" /> 되돌리기
                            </button>
                          </p>
                        ) : (
                          <p className="flex flex-wrap items-center gap-1.5 text-xs" data-testid="location">
                            <MapPin className="size-3.5 text-rose-deep" />
                            <span>
                              {i.exif.lat.toFixed(4)}, {i.exif.lng!.toFixed(4)} · 사진 정보 ·{" "}
                              {i.exif.accuracyM != null ? `정확도 ±${i.exif.accuracyM}m` : "정확도 정보 없음"}
                            </span>
                            <button type="button" className="ml-auto underline" onClick={() => update(i.key, { locationRemoved: true })} disabled={busy}>
                              위치 빼기
                            </button>
                          </p>
                        )
                      ) : (
                        <p className="flex items-center gap-1.5 text-xs text-ink-muted"><MapPinOff className="size-3.5" /> 위치 정보 없음</p>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ready.length > 0 && !memory && (
        <section aria-label="기록 후보">
          <h2 className="font-display text-xl">기록 후보</h2>
          <p className="mb-3 mt-1 text-sm text-ink-muted">
            비슷한 시간·장소에서 찍힌 사진끼리 묶어 봤어요. 묶음은 제안일 뿐이에요. 원하는 대로 정해 주세요.
          </p>
          <div className="space-y-3">
            {groups.map((g, idx) => {
              const c = choiceFor(g.id, g.start);
              const set = (patch: Partial<GroupChoice>) => setChoices((p) => ({ ...p, [g.id]: { ...c, ...patch } }));
              return (
                <fieldset key={g.id} className="card-paper p-4" data-testid="group">
                  <legend className="sr-only">후보 {idx + 1}</legend>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                      {g.items.slice(0, 4).map((i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i.key} src={i.previewUrl} alt="" className="size-10 rounded-sm border-2 border-surface object-cover" />
                      ))}
                    </div>
                    <p className="text-sm">
                      <b className="font-medium">사진 {g.items.length}장</b>
                      <span className="text-ink-muted">
                        {" · "}
                        {g.hasTime ? (g.start === g.end ? fmtTime(g.start!) : `${fmtTime(g.start!)} ~ ${fmtTime(g.end!)}`) : "시각 정보 없음"}
                      </span>
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {(["library", "memory"] as const).map((mode) => (
                      <label key={mode} className={cn("flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5", c.mode === mode && "border-rose-deep bg-rose/10")}>
                        <input type="radio" name={`mode-${g.id}`} checked={c.mode === mode} onChange={() => set({ mode })} disabled={busy} className="accent-[var(--color-rose-deep)]" />
                        {mode === "library" ? "사진만 보관" : "새 기록으로 만들기"}
                      </label>
                    ))}
                  </div>
                  {c.mode === "memory" && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <Label htmlFor={`title-${g.id}`}>기록 제목</Label>
                        <Input id={`title-${g.id}`} value={c.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} disabled={busy} />
                      </div>
                      <div>
                        <Label htmlFor={`date-${g.id}`}>날짜</Label>
                        <Input id={`date-${g.id}`} type="date" value={c.happenedOn} onChange={(e) => set({ happenedOn: e.target.value })} disabled={busy} />
                      </div>
                      <p className="text-xs text-ink-muted sm:col-span-2">새 기록은 ‘나만 보기’로 만들어져요. 공유는 기록 화면에서 직접 할 수 있어요.</p>
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
        </section>
      )}

      {error && <FormMessage error={error} />}

      {ready.length > 0 && (
        <div className="flex items-center gap-4">
          <Button size="lg" onClick={upload} disabled={busy || processing}>
            {busy ? `올리는 중… ${progress}%` : memory ? `‘${memory.title}’에 ${ready.length}장 추가` : `${ready.length}장 저장`}
          </Button>
          {processing && <span className="text-sm text-ink-muted">사진을 읽는 중이에요…</span>}
        </div>
      )}
    </div>
  );
}
