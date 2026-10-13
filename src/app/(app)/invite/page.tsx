import type { Metadata } from "next";
import { HeartHandshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InviteGate } from "@/features/couple/invite-gate";

export const metadata: Metadata = { title: "초대" };

/** 초대 링크는 `/invite#토큰`. 토큰은 브라우저에서만 읽고 서버 액션 본문으로 보낸다(요청 로그에 남지 않게). */
export default function InvitePage() {
  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <HeartHandshake className="mx-auto mb-5 size-10 text-rose-deep" strokeWidth={1.4} />
      <InviteGate />
    </Card>
  );
}
