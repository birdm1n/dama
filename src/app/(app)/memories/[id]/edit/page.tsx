import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getMyCouple } from "@/features/couple/queries";
import { MemoryForm } from "@/features/memories/memory-form";
import { getMemory } from "@/features/memories/queries";
import { todayInSeoul } from "@/features/memories/schema";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "기록 수정" };

export default async function EditMemoryPage({ params }: PageProps<"/memories/[id]/edit">) {
  const { id } = await params;
  const userId = (await getUserId())!;
  const [memory, couple] = await Promise.all([getMemory(userId, id), getMyCouple(userId)]);
  if (!memory || !memory.isMine || memory.couple_id !== couple?.id) notFound();
  const partner = couple.members.find((m) => !m.isMe);
  return (
    <>
      <PageHeader eyebrow="edit" title="기록 수정" />
      <Card className="max-w-2xl">
        <MemoryForm memory={memory} defaultDate={todayInSeoul()} partnerName={partner?.displayName ?? null} />
      </Card>
    </>
  );
}
