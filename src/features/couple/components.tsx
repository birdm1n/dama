"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/features/auth/schema";
import { invitePath } from "./invite-token";
import { acceptInvite, createCouple, createInvite, leaveCouple, updateCouple, type InviteState } from "./actions";

export function CreateCoupleForm() {
  const [state, action] = useActionState<FormState, FormData>(createCouple, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="name">공간 이름 <span className="font-normal text-ink-muted">(선택)</span></Label>
        <Input id="name" name="name" maxLength={40} placeholder="예) 우리의 주말" />
        <FieldError errors={state.fieldErrors?.name} />
      </div>
      <div>
        <Label htmlFor="anniversaryOn">처음 만난 날 <span className="font-normal text-ink-muted">(선택)</span></Label>
        <Input id="anniversaryOn" name="anniversaryOn" type="date" />
        <FieldError errors={state.fieldErrors?.anniversaryOn} />
      </div>
      <FormMessage error={state.error} />
      <SubmitButton pendingText="만드는 중…">커플 공간 만들기</SubmitButton>
    </form>
  );
}

export function InvitePanel({ hasPending, pendingExpiresLabel }: { hasPending: boolean; pendingExpiresLabel?: string }) {
  const [state, action] = useActionState<InviteState>(createInvite, {});
  const [copied, setCopied] = useState(false);
  const link = state.token && typeof window !== "undefined" ? `${window.location.origin}${invitePath(state.token)}` : null;

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (!link) return;
    try {
      await navigator.share({ title: "우리 공간에 초대해요", url: link });
    } catch {
      /* 사용자가 공유를 취소함 */
    }
  }

  return (
    <div className="space-y-4">
      {link ? (
        <div className="space-y-3">
          <div className="rounded-md border border-dashed border-rose-deep/50 bg-bg p-4">
            <p className="break-all font-mono text-[13px] leading-relaxed text-ink">{link}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copy} variant="primary">
              {copied ? <Check /> : <Copy />} {copied ? "복사했어요" : "링크 복사"}
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button type="button" onClick={share} variant="outline">
                <Share2 /> 공유하기
              </Button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">
            이 링크는 지금 한 번만 보여드려요. 24시간 동안 한 사람만 사용할 수 있어요. 상대에게만 보내 주세요.
          </p>
        </div>
      ) : (
        hasPending && (
          <p className="text-sm text-ink-muted">
            아직 사용되지 않은 초대 링크가 있어요{pendingExpiresLabel ? ` (${pendingExpiresLabel}까지 유효)` : ""}. 링크를
            잃어버렸다면 새로 만들어 주세요. 새 링크를 만들면 이전 링크는 자동으로 취소돼요.
          </p>
        )
      )}
      <FormMessage error={state.error} />
      <form action={action}>
        <SubmitButton variant={link ? "outline" : "rose"} pendingText="만드는 중…">
          {link || hasPending ? "새 초대 링크 만들기" : "초대 링크 만들기"}
        </SubmitButton>
      </form>
    </div>
  );
}

export function AcceptInviteForm({ token, onSubmit }: { token: string; onSubmit?: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(acceptInvite, {});
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage error={state.error} />
      <SubmitButton size="lg" className="w-full" pendingText="연결 중…">초대 수락하고 연결하기</SubmitButton>
    </form>
  );
}

export function CoupleSettingsForm({
  coupleId,
  name,
  anniversaryOn,
}: {
  coupleId: string;
  name: string | null;
  anniversaryOn: string | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateCouple, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="coupleId" value={coupleId} />
      <div>
        <Label htmlFor="name">공간 이름</Label>
        <Input id="name" name="name" maxLength={40} defaultValue={name ?? ""} />
        <FieldError errors={state.fieldErrors?.name} />
      </div>
      <div>
        <Label htmlFor="anniversaryOn">처음 만난 날</Label>
        <Input id="anniversaryOn" name="anniversaryOn" type="date" defaultValue={anniversaryOn ?? ""} />
        <FieldError errors={state.fieldErrors?.anniversaryOn} />
      </div>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton variant="outline" pendingText="저장 중…">저장</SubmitButton>
    </form>
  );
}

export function LeaveCoupleForm({ retentionDays, hasPartner }: { retentionDays: number; hasPartner: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(leaveCouple, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        연결 해제…
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink">
        {hasPartner && <li>두 사람 모두 이 커플 공간에서 나가게 돼요. 상대의 기록과 사진은 즉시 볼 수 없어요.</li>}
        <li>
          내가 작성한 기록은 {retentionDays}일 동안 읽기 전용으로 보관돼요. 그동안 내보낼 수 있고, 이후 영구 삭제돼요.
        </li>
        <li>되돌릴 수 없어요. 다시 함께하려면 새 공간을 만들고 다시 초대해야 해요.</li>
      </ul>
      <div>
        <Label htmlFor="confirm">
          계속하려면 <b>연결 해제</b>라고 입력해 주세요
        </Label>
        <Input id="confirm" name="confirm" autoComplete="off" />
      </div>
      <FormMessage error={state.error} />
      <div className="flex gap-2">
        <SubmitButton variant="danger" pendingText="해제 중…">연결 해제</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          취소
        </Button>
      </div>
    </form>
  );
}
