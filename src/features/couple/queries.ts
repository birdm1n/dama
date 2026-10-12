import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CoupleView = {
  id: string;
  name: string | null;
  anniversaryOn: string | null;
  createdAt: string;
  members: { userId: string; displayName: string; joinedAt: string; isMe: boolean }[];
  pendingInvite: { id: string; expiresAt: string } | null;
};

export type ArchivedCouple = { id: string; dissolvedAt: string; purgeAfter: string };

/**
 * 내 활성 커플. RLS가 이미 "내 커플만" 보이게 하므로 여기서는 화면용으로 모으기만 한다.
 */
export async function getMyCouple(userId: string): Promise<CoupleView | null> {
  const supabase = await createClient();

  const { data: couple } = await supabase
    .from("couples")
    .select("id, name, anniversary_on, created_at")
    .eq("status", "active")
    .maybeSingle();
  if (!couple) return null;

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("couple_members")
      .select("user_id, joined_at")
      .eq("couple_id", couple.id)
      .is("left_at", null)
      .order("joined_at"),
    supabase
      .from("couple_invites")
      .select("id, expires_at")
      .eq("couple_id", couple.id)
      .is("used_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] as { id: string; display_name: string }[] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return {
    id: couple.id,
    name: couple.name,
    anniversaryOn: couple.anniversary_on,
    createdAt: couple.created_at,
    members: (members ?? []).map((m) => ({
      userId: m.user_id,
      displayName: nameOf.get(m.user_id) ?? "알 수 없음",
      joinedAt: m.joined_at,
      isMe: m.user_id === userId,
    })),
    pendingInvite: invites?.[0] ? { id: invites[0].id, expiresAt: invites[0].expires_at } : null,
  };
}

export async function getArchivedCouples(): Promise<ArchivedCouple[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("couples")
    .select("id, dissolved_at, purge_after")
    .eq("status", "dissolved")
    .order("dissolved_at", { ascending: false });
  return (data ?? []).map((c) => ({ id: c.id, dissolvedAt: c.dissolved_at!, purgeAfter: c.purge_after! }));
}

export async function getMyProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, display_name").eq("id", userId).maybeSingle();
  return data;
}

export async function getInvitePreview(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_invite_preview", { p_token: token })
    .single<{ inviter_name: string | null; couple_name: string | null; expires_at: string | null; status: string }>();
  if (error || !data) return { status: "invalid" as const, inviterName: null, coupleName: null, expiresAt: null };
  return {
    status: data.status as "valid" | "own" | "invalid" | "expired" | "used" | "revoked",
    inviterName: data.inviter_name,
    coupleName: data.couple_name,
    expiresAt: data.expires_at,
  };
}
