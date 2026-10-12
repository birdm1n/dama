import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/input";
import { site } from "@/config/site";
import {
  CoupleSettingsForm,
  CreateCoupleForm,
  InvitePanel,
  LeaveCoupleForm,
} from "@/features/couple/components";
import { getArchivedCouples, getMyCouple } from "@/features/couple/queries";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "커플" };

export default async function CouplePage({ searchParams }: PageProps<"/couple">) {
  const sp = await searchParams;
  const userId = (await getUserId())!;
  const [couple, archived] = await Promise.all([getMyCouple(userId), getArchivedCouples()]);

  const archiveNotice = archived.length > 0 && (
    <Card className="mt-6 bg-beige/40">
      <CardTitle className="text-lg">보관 중인 이전 공간</CardTitle>
      {archived.map((a) => (
        <CardDescription key={a.id}>
          {formatDate(a.dissolvedAt)}에 연결이 해제됐어요. 내가 쓴 기록은 {formatDate(a.purgeAfter)}까지 읽기 전용으로
          보관된 뒤 영구 삭제돼요.
        </CardDescription>
      ))}
    </Card>
  );

  if (!couple) {
    return (
      <>
        <PageHeader eyebrow="couple" title="커플 공간 만들기">
          공간을 만든 뒤 초대 링크를 상대에게 보내면 연결돼요. 이미 초대 링크를 받았다면, 공간을 만들지 말고 받은 링크를
          열어 주세요.
        </PageHeader>
        {sp.left && <FormMessage message="연결을 해제했어요." />}
        <Card className="mt-4 max-w-lg">
          <CreateCoupleForm />
        </Card>
        {archiveNotice}
      </>
    );
  }

  const me = couple.members.find((m) => m.isMe);
  const partner = couple.members.find((m) => !m.isMe);

  return (
    <>
      <PageHeader eyebrow="couple" title={couple.name ?? "우리의 공간"}>
        {partner ? "두 사람이 연결되어 있어요." : "아직 상대가 연결되지 않았어요."}
      </PageHeader>
      {sp.joined && <FormMessage message={`${partner?.displayName ?? "상대"}님과 연결됐어요!`} />}

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <Card>
          <CardTitle>우리</CardTitle>
          <ul className="mt-4 space-y-3">
            {[me, partner].map((m, i) =>
              m ? (
                <li key={m.userId} className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-rose/40 font-display text-ink">
                    {m.displayName.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block text-[15px]">
                      {m.displayName} {m.isMe && <span className="text-xs text-ink-muted">(나)</span>}
                    </span>
                    <span className="text-xs text-ink-muted">{formatDate(m.joinedAt)} 연결</span>
                  </span>
                </li>
              ) : (
                <li key={`empty-${i}`} className="flex items-center gap-3 text-ink-muted">
                  <span className="grid size-10 place-items-center rounded-full border border-dashed border-border">?</span>
                  <span className="text-sm">초대를 기다리는 중</span>
                </li>
              ),
            )}
          </ul>
        </Card>

        {!partner && (
          <Card>
            <CardTitle>상대 초대하기</CardTitle>
            <CardDescription className="mb-5">
              링크는 {site.inviteValidHours}시간 동안, 한 번만 사용할 수 있어요.
            </CardDescription>
            <InvitePanel
              hasPending={Boolean(couple.pendingInvite)}
              pendingExpiresLabel={couple.pendingInvite ? formatDateTime(couple.pendingInvite.expiresAt) : undefined}
            />
          </Card>
        )}

        <Card>
          <CardTitle>공간 정보</CardTitle>
          <div className="mt-5">
            <CoupleSettingsForm coupleId={couple.id} name={couple.name} anniversaryOn={couple.anniversaryOn} />
          </div>
        </Card>

        <Card className="border-danger/20">
          <CardTitle>연결 해제</CardTitle>
          <CardDescription className="mb-5">
            해제하면 상대의 기록은 즉시 볼 수 없게 되고, 내가 쓴 기록만 {site.dissolveRetentionDays}일간 보관돼요.
          </CardDescription>
          <LeaveCoupleForm retentionDays={site.dissolveRetentionDays} hasPartner={Boolean(partner)} />
        </Card>
      </div>
      {archiveNotice}
    </>
  );
}
