import Link from "next/link";
import { Lock } from "lucide-react";
import { formatDate } from "@/lib/dates";
import type { Memory } from "./types";

/** 스크랩북 느낌의 기록 카드. 사진이 있으면 첫 사진이 폴라로이드처럼 위에 놓인다. */
export function MemoryCard({ memory, coverUrl }: { memory: Memory; coverUrl?: string | null }) {
  return (
    <Link
      href={`/memories/${memory.id}`}
      className="card-paper group block break-inside-avoid p-5 transition-colors hover:bg-beige/25"
    >
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" loading="lazy" className="-mx-2 -mt-2 mb-4 aspect-[4/3] w-[calc(100%+1rem)] max-w-none rounded-sm bg-beige object-cover" />
      )}
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
