/**
 * Cloudflare Worker 진입점: OpenNext가 만든 Next.js 핸들러 + 정기 작업(Cron Trigger).
 *
 * 크론은 외부 HTTP 없이 같은 워커 안에서 정리 라우트를 호출한다.
 *  - 삭제된 사진·공개 글 이미지 파일 정리: POST /api/cron/storage-cleanup
 * (해제 후 30일 지난 커플 데이터 삭제는 DB의 pg_cron이 담당한다)
 */
// 빌드 시 OpenNext가 생성하는 파일 (wrangler가 번들링하며, 앱 타입 검사에서는 제외)
import { default as handler } from "./.open-next/worker.js";

type Env = { CRON_SECRET?: string };

// www로 들어오면 대표 주소로 보낸다(로그인 쿠키·Supabase 리디렉트 주소를 한 출처로 유지)
const CANONICAL_HOST = "dama.me.kr";

const worker = {
  fetch(req: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const url = new URL(req.url);
    if (url.hostname === `www.${CANONICAL_HOST}`) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    return handler.fetch(req, env, ctx);
  },

  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (!env.CRON_SECRET) {
      console.error("CRON_SECRET이 없어 저장소 정리 작업을 건너뜁니다.");
      return;
    }
    const req = new Request("https://internal.invalid/api/cron/storage-cleanup", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(
      Promise.resolve(handler.fetch(req, env, ctx)).then(async (res: Response) => {
        console.log("storage-cleanup", res.status, await res.text());
      }),
    );
  },
};

export default worker;
