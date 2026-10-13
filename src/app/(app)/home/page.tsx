import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getMyCouple, getMyProfile } from "@/features/couple/queries";
import { getUserId } from "@/lib/supabase/server";
import { daysTogether } from "@/lib/dates";

export const metadata: Metadata = { title: "홈" };

export default async function HomePage() {
  const userId = (await getUserId())!;
  const [profile, couple] = await Promise.all([getMyProfile(userId), getMyCouple(userId)]);
  const partner = couple?.members.find((m) => !m.isMe);

  return (
    <>
      <PageHeader eyebrow="today" title={`${profile?.display_name ?? ""}님, 안녕하세요`}>
        {partner ? (
          <>
            <b className="font-medium text-ink">{partner.displayName}</b>님과 연결되어 있어요.
            {couple?.anniversaryOn && <> 함께한 지 {daysTogether(couple.anniversaryOn)}일째.</>}
          </>
        ) : couple ? (
          "커플 공간을 만들었어요. 이제 상대를 초대해 볼까요?"
        ) : (
          "아직 커플 공간이 없어요. 공간을 만들고 상대를 초대해 보세요."
        )}
      </PageHeader>

      {!partner && (
        <Card className="mb-6 bg-beige/40">
          <CardTitle>{couple ? "상대를 초대해 주세요" : "커플 공간 만들기"}</CardTitle>
          <CardDescription>
            {couple
              ? "초대 링크는 24시간 동안 한 번만 쓸 수 있어요."
              : "공간을 만든 뒤 초대 링크로 상대와 연결돼요. 이미 초대 링크를 받았다면 그 링크를 열어 주세요."}
          </CardDescription>
          <Link href="/couple" className={buttonVariants({ className: "mt-5" })}>
            {couple ? "초대 링크 만들기" : "시작하기"} <ArrowRight />
          </Link>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "기록", desc: "사진·메모·장소로 하루를 남겨요.", href: "/memories", soon: false },
          { title: "지도", desc: "우리가 다녀간 곳을 지도에서 봐요.", href: "/map", soon: false },
          { title: "발견", desc: "다른 커플이 공개한 데이트 코스.", href: "/discover", soon: true },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="card-paper block p-5 transition-colors hover:bg-beige/30">
            <p className="font-display text-lg">{item.title}</p>
            <p className="mt-1 text-sm text-ink-muted">{item.desc}</p>
            {item.soon && <p className="mt-4 text-xs text-ink-muted">준비 중</p>}
          </Link>
        ))}
      </div>
    </>
  );
}
