import Link from "next/link";
import type { Metadata } from "next";
import { HeartHandshake } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AcceptInviteForm } from "@/features/couple/components";
import { getInvitePreview, getMyCouple } from "@/features/couple/queries";
import { formatDateTime } from "@/lib/dates";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "초대" };

const INVALID_TEXT: Record<string, { title: string; body: string }> = {
  invalid: { title: "유효하지 않은 링크예요", body: "링크가 잘렸거나 잘못 복사됐을 수 있어요. 상대에게 다시 받아 주세요." },
  expired: { title: "만료된 링크예요", body: "초대 링크는 24시간 동안만 유효해요. 상대에게 새 링크를 요청해 주세요." },
  used: { title: "이미 사용된 링크예요", body: "초대 링크는 한 번만 쓸 수 있어요." },
  revoked: { title: "취소된 링크예요", body: "상대가 새 링크를 만들었거나 초대를 취소했어요. 새 링크를 요청해 주세요." },
};

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const userId = (await getUserId())!;
  const [preview, myCouple] = await Promise.all([getInvitePreview(token), getMyCouple(userId)]);

  let body: React.ReactNode;
  if (preview.status === "own") {
    body = (
      <>
        <h1 className="font-display text-2xl">내가 만든 초대 링크예요</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">이 링크를 상대에게 보내 주세요. 상대가 열어서 수락하면 연결돼요.</p>
        <Link href="/couple" className={buttonVariants({ variant: "outline", className: "mt-6" })}>커플 공간으로</Link>
      </>
    );
  } else if (preview.status !== "valid") {
    const t = INVALID_TEXT[preview.status] ?? INVALID_TEXT.invalid;
    body = (
      <>
        <h1 className="font-display text-2xl">{t.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.body}</p>
        <Link href="/home" className={buttonVariants({ variant: "outline", className: "mt-6" })}>홈으로</Link>
      </>
    );
  } else if (myCouple) {
    body = (
      <>
        <h1 className="font-display text-2xl">이미 커플 공간이 있어요</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          <b className="text-ink">{preview.inviterName}</b>님의 초대를 수락하려면 먼저 지금 공간의 연결을 해제해야 해요.
          한 사람은 하나의 커플 공간에만 속할 수 있어요.
        </p>
        <Link href="/couple" className={buttonVariants({ variant: "outline", className: "mt-6" })}>내 커플 공간 보기</Link>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="font-display text-2xl">
          <b className="font-semibold">{preview.inviterName}</b>님이
          <br />
          {preview.coupleName ? `‘${preview.coupleName}’에 ` : ""}초대했어요
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          수락하면 두 사람이 하나의 커플 공간을 함께 써요. 각자 올린 사진과 기록은 직접 공유하기 전까지 상대에게 자동으로
          보이지 않아요.
        </p>
        {preview.expiresAt && (
          <p className="mt-2 text-xs text-ink-muted">{formatDateTime(preview.expiresAt)}까지 유효</p>
        )}
        <div className="mt-6">
          <AcceptInviteForm token={token} />
        </div>
      </>
    );
  }

  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <HeartHandshake className="mx-auto mb-5 size-10 text-rose-deep" strokeWidth={1.4} />
      {body}
    </Card>
  );
}
