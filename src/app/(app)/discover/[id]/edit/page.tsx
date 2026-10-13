import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EditPostForm } from "@/features/discover/edit-form";
import { getPost } from "@/features/discover/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "공개 글 수정" };

export default async function EditPostPage({ params }: PageProps<"/discover/[id]/edit">) {
  const { id } = await params;
  const userId = (await getUserId())!;
  const post = await getPost(userId, id);
  if (!post || !post.isMine || !(post.status === "published" || post.status === "hidden")) notFound();
  return (
    <>
      <PageHeader eyebrow="edit" title="공개 글 수정" />
      <Card className="max-w-2xl"><EditPostForm post={post} /></Card>
    </>
  );
}
