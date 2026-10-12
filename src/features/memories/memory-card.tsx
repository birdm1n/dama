import Link from "next/link";
import { Lock } from "lucide-react";
import { formatDate } from "@/lib/dates";
import type { Memory } from "./types";

/** 스크랩북 느낌의 기록 카드. 사진 기능 전이라 텍스트 카드다. */
export function MemoryCard({ memory }: { memory: Memory }) {
  return (
    <Link
      href={`/memories/${memory.id}`}
      className="card-paper group block break-inside-avoid p-5 transition-colors hover:bg-beige/25"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        <time dateTime={memory.happened_on}>{formatDate(memory.happened_on)}</time>
        {memory.share_status === "draft" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-beige px-2 py-0.5">
            <Lock className="size-3" /> 나만 보기
          </span>
        ) : (
          <span>{memory.authorName}</span>
        )}
      </div>
      <h3 className="mt-2 font-display text-lg leading-snug text-ink group-hover:underline group-hover:decoration-rose-deep group-hover:underline-offset-4">
        {memory.title}
      </h3>
      {memory.body && <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{memory.body}</p>}
      {memory.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {memory.tags.map((t) => (
            <li key={t} className="rounded-full bg-sage/20 px-2 py-0.5 text-xs text-sage-deep">#{t}</li>
          ))}
        </ul>
      )}
    </Link>
  );
}
