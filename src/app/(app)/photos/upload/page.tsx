import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getMyCouple } from "@/features/couple/queries";
import { getMemory } from "@/features/memories/queries";
import { PhotoUploader } from "@/features/photos/uploader";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "사진 올리기" };

export default async function UploadPage({ searchParams }: PageProps<"/photos/upload">) {
  const sp = await searchParams;
  const userId = (await getUserId())!;
  const couple = await getMyCouple(userId);
  if (!couple) redirect("/memories");

  const memoryId = typeof sp.memory === "string" ? sp.memory : null;
  const memory = memoryId ? await getMemory(userId, memoryId) : null;
  // 내 기록(현재 커플)에만 사진을 붙일 수 있다. DB 정책도 같은 규칙을 강제한다.
  const target = memory && memory.isMine && memory.couple_id === couple.id ? { id: memory.id, title: memory.title } : null;

  return (
    <>
      <PageHeader eyebrow="photos" title={target ? "기록에 사진 추가" : "사진 올리기"}>
        {target ? `‘${target.title}’에 사진을 붙여요.` : "사진을 고르면 촬영 시각과 위치를 읽어 기록 후보로 묶어 드려요."}
      </PageHeader>
      <div className="max-w-3xl">
        <PhotoUploader coupleId={couple.id} userId={userId} memory={target} />
      </div>
    </>
  );
}
