"use client";

import { useActionState } from "react";
import { FormMessage, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/features/auth/schema";
import { moderatePost } from "./actions";

export function ModerateForm({ postId }: { postId: string }) {
  const [state, action] = useActionState<FormState, FormData>(moderatePost, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="postId" value={postId} />
      <Input name="note" maxLength={500} placeholder="처리 메모(선택, 운영 기록에만 남음)" aria-label="처리 메모" className="h-9 text-sm" />
      <div className="flex gap-2">
        <SubmitButton name="decision" value="restore" size="sm" variant="outline" pendingText="처리 중…">복구(신고 기각)</SubmitButton>
        <SubmitButton name="decision" value="remove" size="sm" variant="danger" pendingText="처리 중…">내리기</SubmitButton>
      </div>
      <FormMessage error={state.error} message={state.message} />
    </form>
  );
}
