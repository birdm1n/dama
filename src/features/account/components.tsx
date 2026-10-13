"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/features/auth/schema";
import { createClient } from "@/lib/supabase/browser";
import { deleteAccount, updateDisplayName } from "./actions";
import { DELETE_CONFIRM_TEXT } from "./constants";

export function DisplayNameForm({ name }: { name: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateDisplayName, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="displayName">이름</Label>
        <Input id="displayName" name="displayName" maxLength={30} defaultValue={name} />
        <FieldError errors={state.fieldErrors?.displayName} />
      </div>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton size="sm" variant="outline" pendingText="저장 중…">저장</SubmitButton>
    </form>
  );
}

/** 로그인한 사용자가 자기 이메일로 비밀번호 재설정 링크를 받는다(브라우저에서 호출 — IP 단위 제한) */
export function PasswordResetButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function send() {
    setState("sending");
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setState(error ? "error" : "sent");
  }
  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="outline" onClick={send} disabled={state === "sending" || state === "sent"}>
        {state === "sending" ? "보내는 중…" : "비밀번호 변경 메일 받기"}
      </Button>
      {state === "sent" && <FormMessage message={`${email}로 비밀번호 변경 링크를 보냈어요.`} />}
      {state === "error" && <FormMessage error="메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." />}
    </div>
  );
}

export function DeleteAccountForm({ inCouple, partnerName }: { inCouple: boolean; partnerName: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(deleteAccount, {});
  const [open, setOpen] = useState(false);
  const fe = state.fieldErrors ?? {};
  if (!open) {
    return <Button variant="danger" size="sm" onClick={() => setOpen(true)}>회원 탈퇴…</Button>;
  }
  return (
    <form action={action} className="space-y-4">
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
        <li>계정과 프로필, <b>내가 쓴 기록·사진·장소</b>(보관 중인 것 포함), <b>내 공개 글</b>, 좋아요·저장·신고·차단 목록이 <b>바로 삭제</b>돼요.</li>
        <li>사진 파일은 저장소에서 순차적으로 지워져요(보통 1시간 이내). 그동안에도 누구도 열 수 없어요.</li>
        {inCouple && (
          <li>
            {partnerName ?? "상대"}님과의 연결이 해제돼요. {partnerName ?? "상대"}님이 쓴 기록은 {partnerName ?? "상대"}님에게 30일간 보관돼요.
          </li>
        )}
        <li>되돌릴 수 없어요. 필요하면 먼저 위에서 내 데이터를 내려받아 두세요.</li>
      </ul>
      <div>
        <Label htmlFor="delete-password">비밀번호 확인</Label>
        <Input id="delete-password" name="password" type="password" autoComplete="current-password" />
        <FieldError errors={fe.password} />
      </div>
      <div>
        <Label htmlFor="delete-confirm">계속하려면 <b>{DELETE_CONFIRM_TEXT}</b>라고 입력해 주세요</Label>
        <Input id="delete-confirm" name="confirm" autoComplete="off" />
        <FieldError errors={fe.confirm} />
      </div>
      <FormMessage error={state.error} />
      <div className="flex gap-2">
        <SubmitButton variant="danger" pendingText="탈퇴 처리 중…">탈퇴하기</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>취소</Button>
      </div>
    </form>
  );
}
