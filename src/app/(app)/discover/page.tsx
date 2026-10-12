import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "발견" };

export default function Page() {
  return (
    <>
      <PageHeader title="발견" />
      <ComingSoon title="곧 만나요" description="다른 커플이 직접 공개한 데이트 장소·코스를 둘러보는 곳이에요. 내 기록은 내가 공개를 선택할 때만 올라가요." />
    </>
  );
}
