import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "오픈소스 라이선스" };

const OTHERS = [
  { name: "Next.js · React", license: "MIT" },
  { name: "Supabase JS", license: "MIT" },
  { name: "MapLibre GL JS", license: "BSD-3-Clause", href: "https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt" },
  { name: "exifr", license: "MIT" },
  { name: "zod", license: "MIT" },
  { name: "lucide-react", license: "ISC" },
  { name: "지도 데이터 © OpenStreetMap 기여자, 타일 OpenFreeMap", license: "ODbL", href: "https://www.openstreetmap.org/copyright" },
];

export default function LicensesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <Logo />
      <h1 className="mt-10 font-display text-3xl">오픈소스 라이선스</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{site.name}는 아래 오픈소스 소프트웨어를 사용해요.</p>

      <section className="mt-8 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-semibold">heic-to (libheif 포함) · LGPL-3.0</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          아이폰 HEIC 사진을 변환할 때만 브라우저가 불러오는 별도 파일(<code>/vendor/heic/heic-to.js</code>)로 제공돼요. 앱
          코드와 분리되어 있어 같은 이름의 다른 버전으로 바꿔 쓸 수 있어요. 수정하지 않은 공개 배포본입니다.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            <a className="underline underline-offset-4" href="/vendor/heic/LICENSE.txt">라이선스 전문 (LGPL-3.0)</a>
          </li>
          <li>
            <a className="underline underline-offset-4" href="https://www.gnu.org/licenses/gpl-3.0.html" rel="noreferrer">
              GPL-3.0 전문 (LGPL-3.0이 참조)
            </a>
          </li>
          <li>
            <a className="underline underline-offset-4" href="https://github.com/hoppergee/heic-to" rel="noreferrer">
              소스 코드 (heic-to)
            </a>
            {" · "}
            <a className="underline underline-offset-4" href="https://github.com/strukturag/libheif" rel="noreferrer">
              소스 코드 (libheif)
            </a>
          </li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">그 밖의 라이브러리</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {OTHERS.map((o) => (
            <li key={o.name} className="flex justify-between gap-4 py-2">
              <span>{o.name}</span>
              {o.href ? (
                <a className="text-ink-muted underline underline-offset-4" href={o.href} rel="noreferrer">{o.license}</a>
              ) : (
                <span className="text-ink-muted">{o.license}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/" className="text-ink-muted underline underline-offset-4">처음으로</Link>
      </p>
    </main>
  );
}
