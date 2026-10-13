import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { DiscoverNav } from "@/features/discover/discover-nav";
import { PostGrid } from "@/features/discover/post-card";
import { getBookmarkedPosts } from "@/features/discover/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "저장한 글" };

export default async function SavedPage() {
  const userId = (await getUserId())!;
  const posts = await getBookmarkedPosts(userId);
  return (
    <>
      <PageHeader eyebrow="discover" title="저장한 글">저장한 목록은 나만 볼 수 있어요. 작성자도 누가 저장했는지 알 수 없어요.</PageHeader>
      <DiscoverNav current="/discover/saved" />
      {posts.length ? <PostGrid posts={posts} /> : <p className="text-sm text-ink-muted">저장한 글이 없어요.</p>}
    </>
  );
}
