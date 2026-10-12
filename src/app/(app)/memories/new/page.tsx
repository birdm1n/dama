import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getMyCouple } from "@/features/couple/queries";
import { MemoryForm } from "@/features/memories/memory-form";
import { todayInSeoul } from "@/features/memories/schema";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "새 기록" };

export default async function NewMemoryPage() {
  const userId = (await getUserId())!;
  const couple = await getMyCouple(userId);
  if (!couple) redirect("/memories");
  const partner = couple.members.find((m) => !m.isMe);
  return (
    <>
      <PageHeader eyebrow="new memory" title="새 기록" />
      <Card className="max-w-2xl">
        <MemoryForm defaultDate={todayInSeoul()} partnerName={partner?.displayName ?? null} />
      </Card>
    </>
  );
}
