import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeleteAccountForm, DisplayNameForm, PasswordResetButton } from "@/features/account/components";
import { getMyCouple, getMyProfile } from "@/features/couple/queries";
import { createClient, getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  const userId = (await getUserId())!;
  const supabase = await createClient();
  const [{ data: claims }, profile, couple] = await Promise.all([
    supabase.auth.getClaims(),
    getMyProfile(userId),
    getMyCouple(userId),
  ]);
  const email = (claims?.claims?.email as string | undefined) ?? "";
  const partner = couple?.members.find((m) => !m.isMe);

  return (
    <>
      <PageHeader eyebrow="settings" title="설정" />
      <div className="grid max-w-2xl gap-5">
        <Card>
          <CardTitle>내 정보</CardTitle>
          <CardDescription className="mb-4">이메일: {email}</CardDescription>
          <DisplayNameForm name={profile?.display_name ?? ""} />
        </Card>
        <Card>
          <CardTitle>비밀번호</CardTitle>
          <CardDescription className="mb-4">본인 확인을 위해 이메일로 받은 링크에서 새 비밀번호를 정해요.</CardDescription>
          <PasswordResetButton email={email} />
        </Card>
        <Card>
          <CardTitle>내 데이터 내려받기</CardTitle>
          <CardDescription className="mb-4">내가 쓴 기록·장소·사진 정보·공개 글을 JSON 파일로 받아요. 사진 파일은 포함되지 않아요.</CardDescription>
          <a href="/settings/export" download className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download /> 내 데이터 내려받기
          </a>
        </Card>
        <Card className="border-danger/20">
          <CardTitle>회원 탈퇴</CardTitle>
          <CardDescription className="mb-4">탈퇴하면 내 데이터가 바로 삭제되고 되돌릴 수 없어요.</CardDescription>
          <DeleteAccountForm inCouple={Boolean(couple)} partnerName={partner?.displayName ?? null} />
        </Card>
        <p className="text-center text-xs">
          <Link href="/licenses" className="text-ink-muted underline underline-offset-4">오픈소스 라이선스</Link>
        </p>
      </div>
    </>
  );
}
