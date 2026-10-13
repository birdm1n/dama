"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { attachPhotos } from "./actions";

export function AttachForm({
  memoryId,
  photos,
  shared,
  partnerName,
}: {
  memoryId: string;
  photos: { id: string; thumbUrl: string | null; label: string }[];
  shared: boolean;
  partnerName: string | null;
}) {
  const [state, action] = useActionState(attachPhotos, {} as { error?: string; message?: string });
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="memoryId" value={memoryId} />
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((p) => {
          const on = picked.includes(p.id);
          return (
            <li key={p.id}>
              <label className={cn("relative block cursor-pointer overflow-hidden rounded-sm border-2", on ? "border-rose-deep" : "border-transparent")}>
                <input type="checkbox" name="photoId" value={p.id} checked={on} aria-label={`${p.label} 사진 선택`}
                  onChange={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])}
                  className="absolute left-1.5 top-1.5 z-10 size-4 accent-[var(--color-rose-deep)]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbUrl ?? ""} alt="" className={cn("aspect-square w-full bg-beige object-cover", !on && "opacity-70")} />
                <span className="absolute inset-x-0 bottom-0 bg-surface/85 px-1 py-0.5 text-[10px] text-ink-muted">{p.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {shared && picked.length > 0 && (
        <p className="rounded-md bg-rose/15 px-4 py-3 text-sm" role="note">
          이 기록은 공유 중이라 붙인 사진(과 사진의 위치 정보)을 {partnerName ?? "상대"}님도 보게 돼요.
        </p>
      )}
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton disabled={!picked.length} pendingText="붙이는 중…">{picked.length ? `${picked.length}장 붙이기` : "사진을 골라 주세요"}</SubmitButton>
    </form>
  );
}
