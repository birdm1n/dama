"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/features/auth/schema";
import { updatePost } from "./actions";

export function EditPostForm({ post }: { post: { id: string; title: string; body: string; area: string | null; tags: string[] } }) {
  const [state, action] = useActionState<FormState, FormData>(updatePost, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="postId" value={post.id} />
      <div>
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" maxLength={80} defaultValue={post.title} />
        <FieldError errors={fe.title} />
      </div>
      <div>
        <Label htmlFor="body">소개</Label>
        <textarea id="body" name="body" rows={7} maxLength={3000} defaultValue={post.body}
          className="w-full rounded-md border border-border bg-surface px-4 py-3 text-[15px] leading-relaxed focus:border-rose-deep focus:outline-none" />
        <FieldError errors={fe.body} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="area">지역</Label>
          <Input id="area" name="area" maxLength={40} defaultValue={post.area ?? ""} />
          <FieldError errors={fe.area} />
        </div>
        <div>
          <Label htmlFor="tags">태그</Label>
          <Input id="tags" name="tags" defaultValue={post.tags.join(", ")} />
          <FieldError errors={fe.tags} />
        </div>
      </div>
      <p className="text-xs text-ink-muted">공개한 사진·장소는 여기서 바꿀 수 없어요. 바꾸려면 글을 지우고 기록에서 다시 공개해 주세요.</p>
      <FormMessage error={state.error} />
      <SubmitButton pendingText="저장 중…">수정 저장</SubmitButton>
    </form>
  );
}
