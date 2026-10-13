import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { BottomNav, TopNav } from "@/components/layout/app-nav";
import { signOut } from "@/features/auth/actions";
import { getMyProfile } from "@/features/couple/queries";
import { getIsAdmin, getUserId } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const [profile, isAdmin] = await Promise.all([getMyProfile(userId), getIsAdmin()]);

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Logo href="/home" />
          <TopNav />
          <div className="flex items-center gap-2">
            {isAdmin && (
              <a href="/admin/reports" className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted hover:text-ink">운영</a>
            )}
            <span className="hidden text-sm text-ink-muted sm:inline">{profile?.display_name}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full p-2 text-ink-muted transition-colors hover:bg-beige/60 hover:text-ink"
                aria-label="로그아웃"
                title="로그아웃"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:py-12">{children}</main>
      <BottomNav />
    </div>
  );
}
