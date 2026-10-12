import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { newUser, signUpAndConfirm } from "./helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test("로그인하지 않으면 보호된 페이지에서 로그인으로 보내고, 돌아올 경로를 기억한다", async ({ page }) => {
  await page.goto("/couple");
  await expect(page).toHaveURL(/\/login\?next=%2Fcouple/);
  await page.goto("/invite/some-token");
  await expect(page).toHaveURL(/\/login\?next=%2Finvite%2Fsome-token/);
  await expect(page.getByText("초대를 수락하려면 먼저 로그인해 주세요.")).toBeVisible();
});

test("두 계정이 초대 링크로 커플이 되고, 제3자는 그 데이터에 접근하지 못하며, 연결 해제가 된다", async ({ browser }) => {
  const ana = newUser("Ana");
  const ben = newUser("Ben");
  const cy = newUser("Cy");

  // 1) A 가입 → 인증 → 커플 공간 생성
  const a = await signUpAndConfirm(browser, ana);
  await expect(a).toHaveURL(/\/home$/);
  await expect(a.getByRole("heading", { name: "Ana님, 안녕하세요" })).toBeVisible();
  await a.goto("/couple");
  await a.getByLabel(/공간 이름/).fill("주말의 우리");
  await a.getByRole("button", { name: "커플 공간 만들기" }).click();
  await expect(a.getByRole("heading", { name: "주말의 우리" })).toBeVisible();

  // 2) 초대 링크 발급
  await a.getByRole("button", { name: "초대 링크 만들기" }).click();
  const linkText = await a.locator("p.font-mono").innerText();
  const inviteUrl = new URL(linkText.trim());
  expect(inviteUrl.pathname).toMatch(/^\/invite\/[A-Za-z0-9_-]{43}$/);

  // 3) B는 초대 링크로 들어와 가입 → 인증 후 초대 페이지로 돌아와 수락
  const b = await signUpAndConfirm(browser, ben, inviteUrl.pathname);
  await expect(b).toHaveURL(inviteUrl.pathname);
  await expect(b.getByRole("heading", { name: /Ana님이/ })).toBeVisible();
  await b.getByRole("button", { name: "초대 수락하고 연결하기" }).click();
  await expect(b.getByText("Ana님과 연결됐어요!")).toBeVisible();
  const members = b.getByRole("list").filter({ hasText: "(나)" });
  await expect(members).toContainText("Ana");
  await expect(members).toContainText("Ben");

  // 4) A 화면에서도 B가 보인다
  await a.reload();
  await expect(a.getByText("두 사람이 연결되어 있어요.")).toBeVisible();
  await expect(a.getByRole("list").filter({ hasText: "(나)" })).toContainText("Ben");

  // 5) 사용된 링크로 C는 들어올 수 없다
  const c = await signUpAndConfirm(browser, cy);
  await c.goto(inviteUrl.pathname);
  await expect(c.getByRole("heading", { name: "이미 사용된 링크예요" })).toBeVisible();
  await c.goto("/couple");
  await expect(c.getByRole("heading", { name: "커플 공간 만들기" })).toBeVisible();

  // 6) 실제 API(PostgREST)로도 격리 확인: C의 토큰으로는 A·B 커플 데이터가 0행
  const asUser = async (u: typeof ana) => {
    const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email: u.email, password: u.password });
    expect(error).toBeNull();
    return client;
  };
  const anaApi = await asUser(ana);
  const { data: anaCouples } = await anaApi.from("couples").select("id");
  expect(anaCouples).toHaveLength(1);
  const coupleId = anaCouples![0].id;

  const cyApi = await asUser(cy);
  expect((await cyApi.from("couples").select("id").eq("id", coupleId)).data).toEqual([]);
  expect((await cyApi.from("couple_members").select("user_id").eq("couple_id", coupleId)).data).toEqual([]);
  expect((await cyApi.from("profiles").select("display_name")).data).toEqual([{ display_name: "Cy" }]);
  const hijack = await cyApi.from("couple_members").insert({ couple_id: coupleId, user_id: crypto.randomUUID() });
  expect(hijack.error).not.toBeNull();
  const anon = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  expect((await anon.from("couples").select("id")).error).not.toBeNull();

  // 7) B가 연결 해제 → 두 사람 모두 커플이 없어진다
  await b.goto("/couple");
  await b.getByRole("button", { name: "연결 해제…" }).click();
  await b.getByLabel(/계속하려면/).fill("연결 해제");
  await b.getByRole("button", { name: "연결 해제", exact: true }).click();
  await expect(b.getByText("연결을 해제했어요.")).toBeVisible();
  await expect(b.getByText(/보관된 뒤 영구 삭제돼요/)).toBeVisible();

  await a.goto("/couple");
  await expect(a.getByRole("heading", { name: "커플 공간 만들기" })).toBeVisible();
  expect((await anaApi.from("profiles").select("display_name")).data).toEqual([{ display_name: "Ana" }]);
});
