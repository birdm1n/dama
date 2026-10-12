import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import { site } from "@/config/site";
import "./globals.css";

const body = Noto_Sans_KR({
  variable: "--font-body",
  weight: ["400", "500", "700"],
  preload: false,
  display: "swap",
});

const display = Noto_Serif_KR({
  variable: "--font-display",
  weight: ["400", "600"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
