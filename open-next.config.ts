import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 모든 페이지가 로그인 사용자별로 동적으로 렌더링되고 개인 데이터를 캐시하지 않으므로
// ISR/증분 캐시(R2 등)는 쓰지 않는다.
export default defineCloudflareConfig({});
