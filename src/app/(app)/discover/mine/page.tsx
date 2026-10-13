import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { FormMessage } from "@/components/ui/input";
import { DiscoverNav } from "@/features/discover/discover-nav";
import { PostGrid } from "@/features/discover/post-card";
import { getMyPosts } from "@/features/discover/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "내 공개 글" };

export default async function MinePage({ searchParams }: PageProps<"/discover/mine">) {
  const sp = await searchParams;
  const userId = (await getUserId())!;
  const posts = await getMyPosts(userId);
  return (
    <>
      <PageHeader eyebrow="discover" title="내 공개 글">
        내 기록에서 만든 공개 사본이에요. 기록을 지워도 공개 글은 남으니, 내리고 싶으면 여기서 숨기거나 지워 주세요.
      </PageHeader>
      <DiscoverNav current="/discover/mine" />
      {sp.deleted && <div className="mb-4"><FormMessage message="공개 글을 지웠어요." /></div>}
      {posts.length ? <PostGrid posts={posts} /> : <p className="text-sm text-ink-muted">아직 공개한 글이 없어요. 기록 화면에서 ‘공개 게시물로 만들기’를 눌러 보세요.</p>}
    </>
  );
}
