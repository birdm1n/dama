"use client";

import { useActionState } from "react";
import { Lock, Users } from "lucide-react";
import { FieldError, FormMessage, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/features/auth/schema";
import { cn } from "@/lib/utils";
import { createMemory, updateMemory } from "./actions";
import type { Memory } from "./types";

export function MemoryForm({
  memory,
  defaultDate,
  partnerName,
}: {
  memory?: Memory;
  defaultDate: string;
  partnerName: string | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(memory ? updateMemory : createMemory, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6" noValidate>
      {memory && <input type="hidden" name="id" value={memory.id} />}
      <div>
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" maxLength={80} required defaultValue={memory?.title}
          placeholder="예) 비 오는 날 성수동 카페" aria-invalid={Boolean(fe.title)} />
        <FieldError errors={fe.title} />
      </div>
      <div>
        <Label htmlFor="happenedOn">날짜</Label>
        <Input id="happenedOn" name="happenedOn" type="date" required className="max-w-56"
          defaultValue={memory?.happened_on ?? defaultDate} aria-invalid={Boolean(fe.happenedOn)} />
        <FieldError errors={fe.happenedOn} />
      </div>
      <div>
        <Label htmlFor="body">메모</Label>
        <textarea
          id="body"
          name="body"
          rows={7}
          maxLength={5000}
          defaultValue={memory?.body}
          placeholder="그날 있었던 일, 기억하고 싶은 말"
          className="w-full rounded-md border border-border bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-muted/70 focus:border-rose-deep focus:outline-none"
        />
        <FieldError errors={fe.body} />
      </div>
      <div>
        <Label htmlFor="tags">태그</Label>
        <Input id="tags" name="tags" defaultValue={memory?.tags.join(", ")} placeholder="쉼표로 구분: 카페, 산책"
          aria-describedby="tags-hint" aria-invalid={Boolean(fe.tags)} />
        <p id="tags-hint" className="mt-1.5 text-xs text-ink-muted">최대 10개, 각 20자까지</p>
        <FieldError errors={fe.tags} />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">누가 볼 수 있나요?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <ShareOption
            value="draft"
            defaultChecked={(memory?.share_status ?? "draft") === "draft"}
            icon={<Lock className="size-4" />}
            title="나만 보기"
            desc="상대에게 보이지 않아요. 나중에 공유할 수 있어요."
          />
          <ShareOption
            value="shared"
            defaultChecked={memory?.share_status === "shared"}
            icon={<Users className="size-4" />}
            title="우리 둘 다 보기"
            desc={partnerName ? `${partnerName}님도 볼 수 있어요.` : "상대가 연결되면 함께 볼 수 있어요."}
          />
        </div>
        <FieldError errors={fe.shareStatus} />
      </fieldset>

      <FormMessage error={state.error} />
      <SubmitButton size="lg" pendingText="저장 중…">{memory ? "수정 저장" : "기록 저장"}</SubmitButton>
    </form>
  );
}

function ShareOption({
  value,
  defaultChecked,
  icon,
  title,
  desc,
}: {
  value: "draft" | "shared";
  defaultChecked: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-md border border-border bg-surface p-4 transition-colors",
        "has-[:checked]:border-rose-deep has-[:checked]:bg-rose/10",
      )}
    >
      <input type="radio" name="shareStatus" value={value} defaultChecked={defaultChecked} className="mt-1 accent-[var(--color-rose-deep)]" />
      <span>
        <span className="flex items-center gap-1.5 text-[15px] font-medium">
          {icon} {title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{desc}</span>
      </span>
    </label>
  );
}
