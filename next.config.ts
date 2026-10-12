import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
