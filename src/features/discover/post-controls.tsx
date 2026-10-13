"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/features/auth/schema";
import { blockAuthor, reportPost } from "./actions";
import { REPORT_REASONS } from "./schema";

export function ReportAndBlock({ postId }: { postId: string }) {
  const [state, action] = useActionState<FormState, FormData>(reportPost, {});
  const [open, setOpen] = useState<"none" | "report" | "block">("none");
  return (
    <div className="space-y-3">
      <div className="flex gap-3 text-xs">
        <button type="button" className="text-ink-muted underline" onClick={() => setOpen(open === "report" ? "none" : "report")}>신고</button>
        <button type="button" className="text-ink-muted underline" onClick={() => setOpen(open === "block" ? "none" : "block")}>이 작성자의 글 보지 않기</button>
      </div>
      {open === "report" && (
        <form action={action} className="card-paper space-y-3 p-4">
          <input type="hidden" name="postId" value={postId} />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">신고 사유</legend>
            {Object.entries(REPORT_REASONS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="radio" name="reason" value={value} className="accent-[var(--color-rose-deep)]" /> {label}
              </label>
            ))}
          </fieldset>
          <div>
            <Label htmlFor="report-detail">자세한 내용 <span className="font-normal text-ink-muted">(선택)</span></Label>
            <textarea id="report-detail" name="detail" maxLength={500} rows={3} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" />
          </div>
          <FormMessage error={state.error} message={state.message} />
          <SubmitButton size="sm" variant="danger" pendingText="접수 중…">신고하기</SubmitButton>
        </form>
      )}
      {open === "block" && (
        <form action={blockAuthor} className="card-paper space-y-3 p-4 text-sm">
          <input type="hidden" name="postId" value={postId} />
          <p>이 작성자의 공개 글이 더 이상 보이지 않고, 이 작성자도 내 공개 글을 볼 수 없어요. 상대에게 알림은 가지 않아요.</p>
          <div className="flex gap-2">
            <SubmitButton size="sm" variant="danger" pendingText="처리 중…">보지 않기</SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen("none")}>취소</Button>
          </div>
        </form>
      )}
    </div>
  );
}
