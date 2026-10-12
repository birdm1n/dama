import { expect, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function newUser(name: string) {
  const id = randomUUID().slice(0, 8);
  return { name, email: `${name.toLowerCase()}-${id}@example.test`, password: `pw${id}A1` };
}
export type E2EUser = ReturnType<typeof newUser>;

/** Mailpit API에서 해당 주소로 온 가장 최근 메일의 인증 링크를 찾는다 */
export async function confirmationLink(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as {
        HTML: string;
        Text: string;
      };
      const m = (msg.HTML || msg.Text).match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/);
      if (m) return m[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`인증 메일을 찾지 못함: ${email}`);
}

/** 회원가입 → 메일 인증 → 로그인된 상태의 페이지 반환 */
export async function signUpAndConfirm(browser: Browser, user: E2EUser, next?: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(next ? `/signup?next=${encodeURIComponent(next)}` : "/signup");
  await page.getByLabel("이름").fill(user.name);
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.getByRole("heading", { name: "메일함을 확인해 주세요" })).toBeVisible();

  await page.goto(await confirmationLink(user.email));
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/"));
  return page;
}
