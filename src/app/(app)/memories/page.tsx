import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "기록" };

export default function Page() {
  return (
    <>
      <PageHeader title="기록" />
      <ComingSoon title="곧 만나요" description="사진·메모·날짜·장소·태그로 둘만의 기록을 남기는 공간이에요. 다음 단계에서 만들어요." />
    </>
  );
}
