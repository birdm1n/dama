import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { confirmationLink, newUser, pairedCouple, signUpAndConfirm, writeMemory } from "./helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test("비밀번호 재설정: 계정 존재를 드러내지 않고, 메일 링크로 새 비밀번호를 정한다", async ({ browser }) => {
  const u = newUser("Ana");
  const a = await signUpAndConfirm(browser, u);
  await a.context().close();

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByRole("link", { name: "비밀번호를 잊었어요" }).click();
  // 로그인 화면에도 "이메일" 칸이 있어서, 이동이 끝나기 전에 입력하면 이전 화면에 들어간다
  await expect(page).toHaveURL(/\/forgot-password$/);
  // 없는 이메일도 같은 안내
  await page.getByLabel("이메일").fill(`nobody-${Date.now()}@example.test`);
  await page.getByRole("button", { name: "재설정 링크 받기" }).click();
  await expect(page.getByText(/가입된 이메일이라면/)).toBeVisible();
  await page.reload();
  await page.getByLabel("이메일").fill(u.email);
  await page.getByRole("button", { name: "재설정 링크 받기" }).click();
  await expect(page.getByText(/가입된 이메일이라면/)).toBeVisible();

  await page.goto(await confirmationLink(u.email)); // 가장 최근 메일 = 재설정 메일
  await page.waitForURL(/\/reset-password/);
  await page.getByLabel("새 비밀번호", { exact: true }).fill("short");
  await page.getByLabel("새 비밀번호 확인").fill("short");
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
  await expect(page.getByText(/8자 이상이어야/)).toBeVisible();
  const newPw = `New${Date.now()}x9`;
  await page.getByLabel("새 비밀번호", { exact: true }).fill(newPw);
  await page.getByLabel("새 비밀번호 확인").fill(newPw);
  await page.getByRole("button", { name: "비밀번호 바꾸기" }).click();
  await expect(page.getByText("비밀번호를 바꿨어요.")).toBeVisible();

  const api = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  expect((await api.auth.signInWithPassword({ email: u.email, password: u.password })).error).not.toBeNull();
  expect((await api.auth.signInWithPassword({ email: u.email, password: newPw })).error).toBeNull();

  // 세션 없이 재설정 화면에 오면 다시 요청하라고 안내
  const fresh = await browser.newContext();
  const p2 = await fresh.newPage();
  await p2.goto("/reset-password");
  await expect(p2).toHaveURL(/\/forgot-password\?expired=1/);
  await ctx.close();
  await fresh.close();
});

test.describe("회원 탈퇴", () => {
  test.skip(!SERVICE_KEY, "SUPABASE_SERVICE_ROLE_KEY가 없으면 계정 삭제를 할 수 없어 건너뜀");

  test("내보내기 → 비밀번호 재확인 → 연결 해제 + 계정·데이터 삭제, 상대 기록은 보관", async ({ browser }) => {
    const { a, b, ua } = await pairedCouple(browser);
    const memoryId = await writeMemory(a, { title: "A의 공유 기록", date: "2026-05-17", share: "우리 둘 다 보기" });
    await a.goto(`/photos/upload?memory=${memoryId}`);
    await a.locator("#photo-input").setInputFiles(path.resolve(__dirname, "../fixtures/forest-1.jpg"));
    await a.getByRole("button", { name: /1장 추가/ }).click();
    await a.waitForURL(new RegExp(`/memories/${memoryId}`));
    await writeMemory(b, { title: "B의 기록", date: "2026-05-18", share: "우리 둘 다 보기" });
    // 공개 글
    await a.goto(`/discover/new?memory=${memoryId}`);
    const postTitle = `탈퇴할 사람의 글 ${Date.now()}`;
    await a.getByLabel("제목", { exact: true }).fill(postTitle);
    await a.getByText("위 내용이 로그인한").click();
    await a.getByRole("button", { name: "공개하기" }).click();
    await a.waitForURL(/published=1/);
    const postUrl = a.url().split("?")[0];

    // 내 데이터 내려받기
    await a.goto("/settings");
    const dl = a.waitForEvent("download");
    await a.getByRole("link", { name: /내 데이터 내려받기/ }).click();
    const data = JSON.parse(readFileSync((await (await dl).path())!, "utf8"));
    expect(data.memories.map((m: { title: string }) => m.title)).toEqual(["A의 공유 기록"]);
    expect(data.photos.items).toHaveLength(1);
    expect(data.public_posts.map((p: { title: string }) => p.title)).toEqual([postTitle]);

    // 확인 문구·비밀번호가 틀리면 진행되지 않는다
    await a.getByRole("button", { name: "회원 탈퇴…" }).click();
    await expect(a.getByText(/Ben님과의 연결이 해제돼요/)).toBeVisible();
    await a.getByLabel("비밀번호 확인").fill("wrong-password1");
    await a.getByLabel(/계속하려면/).fill("탈퇴합니다");
    await a.getByRole("button", { name: "탈퇴하기" }).click();
    await expect(a.getByText("비밀번호가 맞지 않아요.")).toBeVisible();

    await a.getByLabel("비밀번호 확인").fill(ua.password);
    await a.getByLabel(/계속하려면/).fill("탈퇴합니다");
    await a.getByRole("button", { name: "탈퇴하기" }).click();
    await a.waitForURL((url) => url.pathname === "/" && url.search.includes("deleted=1"));
    await expect(a.getByText("탈퇴가 완료됐어요.")).toBeVisible();
    await a.goto("/home");
    await expect(a).toHaveURL(/\/login/); // 세션도 정리됨

    // 다시 로그인할 수 없다
    const api = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    expect((await api.auth.signInWithPassword({ email: ua.email, password: ua.password })).error).not.toBeNull();

    // 상대: 연결이 해제되고, 자기 기록만 보관함에 있다. A의 기록·공개 글은 사라졌다.
    await b.goto("/couple");
    await expect(b.getByRole("heading", { name: "커플 공간 만들기" })).toBeVisible();
    await b.goto("/couple/archive");
    await expect(b.getByText("B의 기록")).toBeVisible();
    await expect(b.getByText("A의 공유 기록")).toHaveCount(0);
    expect((await b.goto(postUrl))?.status()).toBe(404);
  });
});
