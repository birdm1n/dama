import type { NextConfig } from "next";

const HEIC_WORKER_CSP =
  "default-src 'none'; script-src 'self' blob: 'unsafe-eval' 'wasm-unsafe-eval'; worker-src blob:; connect-src data: blob:";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // 로그인 사용자별 민감 데이터가 대부분이라 Cache Components는 쓰지 않는다.
  // (요청마다 서버에서 세션을 읽고, 캐시에 개인 데이터가 남지 않게)
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
      {
        // HEIC 디코더 워커 전용 CSP: libheif 바인딩의 eval을 이 워커 안에서만 허용하고 네트워크는 막는다.
        // (Cloudflare 정적 자산은 public/_headers 에 같은 규칙)
        source: "/vendor/heic/:path*",
        headers: [{ key: "Content-Security-Policy", value: HEIC_WORKER_CSP }],
      },
      {
        // 초대 토큰이 Referer 헤더로 외부에 새지 않게
        source: "/invite/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
