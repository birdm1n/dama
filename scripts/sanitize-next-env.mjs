// OpenNext는 빌드할 때 .env* 파일(.env.local 포함)을 .open-next/cloudflare/next-env.mjs로 복사해
// 워커 번들에 넣는다. 로컬 service_role 키·CRON_SECRET이 배포본에 들어가고, 워커 비밀값을
// 빠뜨리면 그 로컬 값이 조용히 쓰인다. 그래서 빌드 후 공개 값(NEXT_PUBLIC_*)만 남긴다.
// 서버 비밀값은 반드시 `wrangler secret put`(또는 로컬 미리보기는 .dev.vars)으로만 준다.
//
// --deploy: 배포용 빌드가 로컬 Supabase를 가리키면 실패한다.
import { readFileSync, writeFileSync } from "node:fs";

const file = ".open-next/cloudflare/next-env.mjs";
const deploy = process.argv.includes("--deploy");

const mod = await import(new URL(`../${file}`, import.meta.url).href + `?t=${Date.now()}`);
const keepPublic = (vars = {}) =>
  Object.fromEntries(Object.entries(vars).filter(([k]) => k.startsWith("NEXT_PUBLIC_")));

const production = keepPublic(mod.production);
const removed = Object.keys(mod.production ?? {}).filter((k) => !(k in production));

const out =
  `export const production = ${JSON.stringify(production)};\n` +
  `export const development = {};\n` +
  `export const test = {};\n`;
writeFileSync(file, out);
console.log(`next-env: 공개 값 ${Object.keys(production).length}개만 남김` + (removed.length ? `, 제거: ${removed.join(", ")}` : ""));

if (deploy) {
  // 브라우저·서버 번들에 실제로 인라인된 주소(빌드 시점 환경 변수)를 확인한다.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? production.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) {
    console.error(`배포 중단: NEXT_PUBLIC_SUPABASE_URL이 원격 https 주소가 아닙니다 (${url || "없음"}).`);
    console.error("배포할 때는 원격 Supabase 주소·publishable key를 환경 변수로 주고 빌드하세요.");
    process.exit(1);
  }
}

// 확인: 결과 파일에 비공개 키 이름이 남지 않았는지
const text = readFileSync(file, "utf8");
if (/SERVICE_ROLE|CRON_SECRET/.test(text)) {
  console.error("next-env.mjs에 비밀값이 남아 있습니다.");
  process.exit(1);
}
