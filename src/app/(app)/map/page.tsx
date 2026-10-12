import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "지도" };

export default function Page() {
  return (
    <>
      <PageHeader title="지도" />
      <ComingSoon title="곧 만나요" description="기록한 장소를 지도에 표시하고 날짜별 코스를 보여줘요. 장소 사이 선은 실제 이동 경로가 아니라 기록 순서예요." />
    </>
  );
}
