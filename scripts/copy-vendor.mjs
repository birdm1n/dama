// 번들러가 처리하지 않는 브라우저용 파일을 public/vendor/ 아래로 복사해 서빙한다.
//  - MapLibre v6 웹 워커
//  - HEIC 디코더(heic-to, LGPL-3.0)와 그것을 격리 실행하는 워커
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

const maplibre = join(root, "public", "vendor", "maplibre");
mkdirSync(maplibre, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(pkgDir("maplibre-gl"), "dist", f), join(maplibre, f));

const heic = join(root, "public", "vendor", "heic");
mkdirSync(heic, { recursive: true });
copyFileSync(require.resolve("heic-to/next"), join(heic, "heic-to.js"));
copyFileSync(join(root, "scripts", "vendor", "heic-worker.mjs"), join(heic, "heic-worker.mjs"));
// LGPL-3.0 고지: 라이선스 원문을 함께 배포한다(/licenses 화면에서 링크)
copyFileSync(join(root, "node_modules", "heic-to", "LICENSE"), join(heic, "LICENSE.txt"));

console.log("vendor → public/vendor (maplibre, heic)");
