import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-8">
      <Logo />
      <div className="flex flex-1 flex-col justify-center py-10">{children}</div>
      <p className="text-center text-xs">
        <Link href="/licenses" className="text-ink-muted underline underline-offset-4">오픈소스 라이선스</Link>
      </p>
    </main>
  );
}
