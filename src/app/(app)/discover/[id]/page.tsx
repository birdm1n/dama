import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Bookmark, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/input";
import { deletePost, setPostVisibility, toggleBookmark, toggleLike } from "@/features/discover/actions";
import { ReportAndBlock } from "@/features/discover/post-controls";
import { getPost } from "@/features/discover/queries";
import { courseLine } from "@/features/map/course";
import { MapView } from "@/features/map/map-view";
import { formatDate } from "@/lib/dates";
import { getUserId } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "공개 글" };

export default async function PostPage({ params, searchParams }: PageProps<"/discover/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const userId = (await getUserId())!;
  const post = await getPost(userId, id);
  if (!post) notFound(); // 숨김·차단·없음을 구분하지 않는다

  const line = post.kind === "course" ? courseLine(post.places) : null;

  return (
    <article className="mx-auto max-w-2xl">
      <Link href="/discover" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> 발견
      </Link>
      {sp.published && <div className="mb-4"><FormMessage message="공개했어요. 언제든 숨기거나 지울 수 있어요." /></div>}

      <header className="mb-6">
        <p className="text-xs text-ink-muted">
          {post.kind === "course" ? "코스" : "장소"}{post.area && ` · ${post.area}`} · 익명의 커플 · {formatDate(post.created_at)}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight">{post.title}</h1>
        {post.isMine && post.status !== "published" && (
          <p className="mt-3 rounded-md bg-beige px-3 py-2 text-sm">
            {post.status === "hidden" ? "숨긴 글이에요. 나만 볼 수 있어요." : "여러 사람의 신고로 숨겨졌고 검토 중이에요. 다시 공개할 수 없어요."}
          </p>
        )}
      </header>

      {post.images.length > 0 && (
        <ul className="mb-6 grid gap-3">
          {post.images.map((img) => (
            <li key={img.id} className="card-paper p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url ?? ""} alt="" width={img.width} height={img.height} className="w-full rounded-sm bg-beige" />
            </li>
          ))}
        </ul>
      )}
      {post.body && <div className="whitespace-pre-wrap text-[15px] leading-[1.9]">{post.body}</div>}

      {post.places.length > 0 && (
        <section className="mt-8" aria-label="장소">
          <MapView
            pins={post.places.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, label: post.kind === "course" ? String(i + 1) : undefined, title: p.name }))}
            line={line}
            className="h-72"
            ariaLabel="게시물 장소 지도"
          />
          <ol className="mt-3 space-y-1 text-sm">
            {post.places.map((p, i) => <li key={p.id}>{i + 1}. {p.name}</li>)}
          </ol>
          {post.kind === "course" && <p className="mt-2 text-xs text-ink-muted">점선은 작성자가 정한 순서이며 실제 이동 경로가 아니에요.</p>}
        </section>
      )}

      {post.tags.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <li key={t}><Link href={`/discover?tag=${encodeURIComponent(t)}`} className="rounded-full bg-sage/20 px-2.5 py-1 text-xs text-sage-deep">#{t}</Link></li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border pt-6">
        {post.status === "published" && (
          <>
            <form action={toggleLike}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="on" value={post.liked ? "0" : "1"} />
              <Button variant="outline" size="sm" aria-pressed={post.liked}>
                <Heart className={cn(post.liked && "fill-rose-deep text-rose-deep")} /> 좋아요 {post.like_count}
              </Button>
            </form>
            <form action={toggleBookmark}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="on" value={post.bookmarked ? "0" : "1"} />
              <Button variant="outline" size="sm" aria-pressed={post.bookmarked}>
                <Bookmark className={cn(post.bookmarked && "fill-ink")} /> {post.bookmarked ? "저장됨" : "저장"}
              </Button>
            </form>
          </>
        )}
        {post.isMine && (
          <>
            {post.status !== "under_review" && (
              <form action={setPostVisibility}>
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="status" value={post.status === "published" ? "hidden" : "published"} />
                <Button variant="outline" size="sm">{post.status === "published" ? "숨기기" : "다시 공개"}</Button>
              </form>
            )}
            <form action={deletePost}>
              <input type="hidden" name="postId" value={post.id} />
              <Button variant="danger" size="sm">삭제</Button>
            </form>
          </>
        )}
      </div>
      {!post.isMine && post.status === "published" && (
        <div className="mt-4"><ReportAndBlock postId={post.id} /></div>
      )}
    </article>
  );
}
