"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/features/auth/schema";
import { deleteMemory, setMemoryShare } from "./actions";
import type { ShareStatus } from "./types";

export function ShareToggle({
  id,
  status,
  partnerName,
  photoCount = 0,
  locationCount = 0,
  placeCount = 0,
}: {
  id: string;
  status: ShareStatus;
  partnerName: string | null;
  photoCount?: number;
  locationCount?: number;
  placeCount?: number;
}) {
  const [confirming, setConfirming] = useState(false);
  if (status === "shared") {
    return (
      <form action={setMemoryShare}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="shareStatus" value="draft" />
        <SubmitButton variant="outline" size="sm" pendingText="변경 중…">나만 보기로 바꾸기</SubmitButton>
      </form>
    );
  }
  if (!confirming) {
    return (
      <Button variant="rose" size="sm" onClick={() => setConfirming(true)}>
        공유하기…
      </Button>
    );
  }
  return (
    <form action={setMemoryShare} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="shareStatus" value="shared" />
      <span className="text-sm">
        {partnerName ? `${partnerName}님도 이 기록을 보게 돼요.` : "상대가 연결되면 이 기록을 보게 돼요."}
        {photoCount > 0 && ` 사진 ${photoCount}장${locationCount > 0 ? `과 그중 ${locationCount}장의 위치 정보` : ""}도 함께 보여요.`}
        {placeCount > 0 && ` 장소 ${placeCount}곳도 지도에 보여요.`}
      </span>
      <SubmitButton variant="rose" size="sm" pendingText="공유 중…">공유</SubmitButton>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>취소</Button>
    </form>
  );
}

export function DeleteMemory({ id }: { id: string }) {
  const [state, action] = useActionState<FormState, FormData>(deleteMemory, {});
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        삭제…
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="confirm" value="yes" />
      <span className="text-sm">삭제하면 되돌릴 수 없어요.</span>
      <SubmitButton variant="danger" size="sm" pendingText="삭제 중…">삭제</SubmitButton>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>취소</Button>
      <FormMessage error={state.error} />
    </form>
  );
}
