import Link from "next/link";
import { Bookmark, Heart, MapPin, Route } from "lucide-react";
import type { PostCard as Post } from "./queries";

export function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/discover/${post.id}`} className="card-paper block break-inside-avoid p-3 pb-4 transition-colors hover:bg-beige/25" data-testid="post-card">
      {post.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverUrl} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-sm bg-beige object-cover" />
      ) : (
        <div className="grid aspect-[4/3] place-items-center rounded-sm bg-beige/70 px-4 text-center font-display text-lg text-ink-muted">{post.title}</div>
      )}
      <div className="px-1 pt-3">
        <p className="flex items-center gap-1 text-xs text-ink-muted">
          {post.kind === "course" ? <Route className="size-3.5" /> : <MapPin className="size-3.5" />}
          {post.kind === "course" ? "코스" : "장소"}
          {post.area && ` · ${post.area}`}
          {post.status !== "published" && (
            <span className="ml-auto rounded-full bg-beige px-2 py-0.5">{post.status === "hidden" ? "숨김" : post.status === "removed" ? "운영 정책으로 내려짐" : "신고로 검토 중"}</span>
          )}
        </p>
        <h3 className="mt-1 font-display text-[17px] leading-snug">{post.title}</h3>
        <p className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1"><Heart className={`size-3.5 ${post.liked ? "fill-rose-deep text-rose-deep" : ""}`} />{post.like_count}</span>
          {post.bookmarked && <span className="inline-flex items-center gap-1"><Bookmark className="size-3.5 fill-ink" />저장됨</span>}
        </p>
      </div>
    </Link>
  );
}

export function PostGrid({ posts }: { posts: Post[] }) {
  return (
    <div className="columns-2 gap-3 space-y-3 md:columns-3 lg:columns-4">
      {posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}
