import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { newUser, signUpAndConfirm, writeMemory } from "./helpers";

const FIX = path.resolve(__dirname, "../fixtures");

/** 페이지에서 일어난 CSP 위반을 모은다 */
async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI} @ ${e.sourceFile}:${e.lineNumber}:${e.columnNumber}`);
    });
  });
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);

test("보안 헤더와 CSP: 요청마다 다른 nonce, 인라인 스크립트에 nonce, 주요 화면에서 위반 없음", async ({ browser, request }) => {
  // 헤더
  const r1 = await request.get("/login");
  const r2 = await request.get("/login");
  const csp1 = r1.headers()["content-security-policy"];
  const csp2 = r2.headers()["content-security-policy"];
  expect(csp1).toContain("script-src 'self' 'nonce-");
  expect(csp1).toContain("frame-ancestors 'none'");
  expect(csp1).not.toBe(csp2); // nonce가 매번 다르다
  expect(r1.headers()["x-frame-options"]).toBe("DENY");
  expect(r1.headers()["x-content-type-options"]).toBe("nosniff");
  expect(r1.headers()["x-powered-by"]).toBeUndefined();
  const nonce = csp1.match(/'nonce-([^']+)'/)![1];
  const html = await r1.text();
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((m) => m[1]);
  expect(inline.length).toBeGreaterThan(0);
  for (const attrs of inline) expect(attrs).toContain(`nonce="${nonce}"`);
  // 404도 동적으로 렌더링되어 nonce가 붙는다
  const nf = await request.get("/no-such-page");
  expect(nf.status()).toBe(404);
  expect(nf.headers()["content-security-policy"]).toContain("'nonce-");

  // 실제 화면들에서 CSP 위반이 없는지
  const context = await browser.newContext();
  const a = await signUpAndConfirm(browser, newUser("Ana")); // 가입 흐름
  await watchCsp(a);
  await a.goto("/couple");
  await a.getByRole("button", { name: "커플 공간 만들기" }).click();

  const memoryId = await writeMemory(a, { title: "CSP 점검", date: "2026-05-17", share: "나만 보기" });
  await a.goto(`/photos/upload?memory=${memoryId}`); // EXIF 읽기 + HEIC(WebAssembly) 디코더 + 워커
  await a.locator("#photo-input").setInputFiles([path.join(FIX, "forest-1.jpg"), path.join(FIX, "synthetic.heic")]);
  await expect(a.getByText("읽는 중…")).toHaveCount(0, { timeout: 30_000 });
  expect(await violations(a)).toEqual([]);
  await a.getByRole("button", { name: /2장 추가/ }).click();
  await a.waitForURL(new RegExp(`/memories/${memoryId}`));
  await expect.poll(() => a.locator("article img").first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(await violations(a)).toEqual([]);

  await a.goto(`/memories/${memoryId}/places`); // MapLibre(워커) + 사진 위치
  await expect(a.locator("[data-ready=true]")).toBeVisible({ timeout: 15_000 });
  await a.getByRole("button", { name: /사진 위치/ }).first().click();
  await a.getByLabel("장소 이름").fill("CSP 장소");
  await a.getByRole("button", { name: "장소 추가" }).click();
  await expect(a.getByText("장소를 추가했어요.")).toBeVisible();
  await a.goto("/map?date=2026-05-17");
  await expect(a.locator("[data-ready=true]")).toBeVisible({ timeout: 15_000 });
  await a.goto("/discover");
  await a.goto("/home");
  // 배경 지도 서버(외부)는 이 환경에서 막혀 있어 네트워크 오류가 나지만, 이는 CSP 위반이 아니다
  expect(await violations(a)).toEqual([]);
  await context.close();
});

test("인증: 계정 존재 여부를 드러내지 않고, 로그인 후 외부 사이트로 보내지 않는다", async ({ browser, page, baseURL }) => {
  const u = newUser("Ana");
  const a = await signUpAndConfirm(browser, u);
  await a.context().close();

  // 틀린 비밀번호 / 없는 계정 → 같은 문구
  for (const [email, pw] of [[u.email, "wrongpass1"], [`nobody-${Date.now()}@example.test`, "whatever1"]]) {
    await page.goto("/login");
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill(pw);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByText("이메일 또는 비밀번호가 맞지 않아요.")).toBeVisible();
  }

  // 이미 가입된 이메일로 다시 가입해도 새 가입과 같은 화면
  await page.goto("/signup");
  await page.getByLabel("이름").fill("다른사람");
  await page.getByLabel("이메일").fill(u.email);
  await page.getByLabel("비밀번호").fill("another123");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.getByRole("heading", { name: "메일함을 확인해 주세요" })).toBeVisible();

  // 오픈 리다이렉트 방지
  await page.goto("/login?next=" + encodeURIComponent("//evil.example.com/steal"));
  await page.getByLabel("이메일").fill(u.email);
  await page.getByLabel("비밀번호").fill(u.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL((url) => url.pathname === "/home");
  expect(new URL(page.url()).host).toBe(new URL(baseURL!).host); // 같은 사이트에 머문다
});

test("오픈소스 라이선스: 로그인 없이 보이고 LGPL 전문이 함께 배포된다", async ({ page, request }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "오픈소스 라이선스" }).click();
  await expect(page).toHaveURL(/\/licenses$/);
  await expect(page.getByRole("heading", { name: /heic-to.*LGPL-3\.0/ })).toBeVisible();
  const res = await request.get("/vendor/heic/LICENSE.txt");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("GNU Lesser General Public License");
});
