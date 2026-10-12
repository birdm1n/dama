import { test, expect } from "@playwright/test";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { pairedCouple } from "./helpers";

const FIX = path.resolve(__dirname, "../fixtures");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test("사진: EXIF 확인·수정 → 기록 후보 → 업로드, 위치 제거된 파일, 공유 전엔 상대에게 비공개", async ({ browser }) => {
  const { a, b, ub } = await pairedCouple(browser);

  // 1) 사진 고르기 → EXIF 읽기
  await a.goto("/photos/upload");
  await a.locator("#photo-input").setInputFiles(["forest-1.jpg", "forest-2.jpg", "no-gps.jpg"].map((f) => path.join(FIX, f)));
  const items = a.getByTestId("photo-item");
  await expect(items).toHaveCount(3);
  await expect(a.getByText("읽는 중…")).toHaveCount(0);

  const item = (name: string) => items.filter({ hasText: name });
  await expect(item("forest-1.jpg").getByTestId("location")).toContainText("37.5446, 127.0374 · 사진 정보 · 정확도 ±8m");
  await expect(item("forest-2.jpg").getByTestId("location")).toContainText("정확도 정보 없음");
  await expect(item("no-gps.jpg")).toContainText("위치 정보 없음");
  await expect(item("forest-1.jpg").getByLabel("촬영 시각")).toHaveValue("2026-05-17T14:30");
  await expect(item("forest-1.jpg").getByTestId("time-source")).toHaveText("사진 정보 기준");
  await expect(item("no-gps.jpg").getByTestId("time-source")).toContainText("이 기기 시간대로 추정");

  // 2) 사용자가 수정: forest-2 위치 빼기, no-gps 시각 고치기
  await item("forest-2.jpg").getByRole("button", { name: "위치 빼기" }).click();
  await expect(item("forest-2.jpg")).toContainText("위치를 저장하지 않아요");
  await item("no-gps.jpg").getByLabel("촬영 시각").fill("2026-06-02T20:00");
  await expect(item("no-gps.jpg").getByTestId("time-source")).toHaveText("직접 입력");

  // 3) 기록 후보: 5/17 두 장이 한 묶음, 6/2 한 장
  const groups = a.getByTestId("group");
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toContainText("사진 2장");
  await groups.nth(0).getByText("새 기록으로 만들기").click();
  await groups.nth(0).getByLabel("기록 제목").fill("서울숲 산책");
  await expect(groups.nth(0).getByLabel("날짜")).toHaveValue("2026-05-17");

  await a.getByRole("button", { name: "3장 저장" }).click();
  await a.waitForURL(/\/memories\/[0-9a-f-]{36}\?saved=1/);
  const memoryUrl = a.url().split("?")[0];
  await expect(a.getByRole("heading", { name: "서울숲 산책" })).toBeVisible();
  await expect(a.getByText("나만 보기")).toBeVisible();
  const imgs = a.locator("article img");
  await expect(imgs).toHaveCount(2);
  await expect(a.getByText(/37\.5446, 127\.0374 · 사진 정보 · ±8m/)).toBeVisible();
  await expect(a.getByText(/37\.5451/)).toHaveCount(0); // 뺀 위치는 저장되지 않음

  // 저장된 파일: WebP로 다시 인코딩되어 EXIF(위치)가 없다
  const src = await imgs.first().getAttribute("src");
  const bytes = Buffer.from(await (await fetch(src!)).arrayBuffer());
  expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
  expect(bytes.includes(Buffer.from("EXIF"))).toBe(false);
  expect(bytes.includes(Buffer.from("Exif"))).toBe(false);

  // 4) 공유 전: B는 기록·사진 모두 볼 수 없다 (화면 + API)
  await b.goto("/memories");
  await expect(b.getByText("서울숲 산책")).toHaveCount(0);
  expect((await b.goto(memoryUrl))?.status()).toBe(404);
  const bApi = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  await bApi.auth.signInWithPassword({ email: ub.email, password: ub.password });
  expect((await bApi.from("photos").select("id")).data).toEqual([]);
  const filePath = decodeURIComponent(new URL(src!).pathname.split("/object/sign/couple-photos/")[1]);
  const signed = await bApi.storage.from("couple-photos").createSignedUrl(filePath, 60);
  expect(signed.data?.signedUrl).toBeFalsy();
  const direct = await bApi.storage.from("couple-photos").download(filePath);
  expect(direct.data).toBeNull();

  // 5) A가 공유 — 사진·위치도 함께 보인다는 안내
  await a.getByRole("button", { name: "공유하기…" }).click();
  await expect(a.getByText("사진 2장과 그중 1장의 위치 정보도 함께 보여요.", { exact: false })).toBeVisible();
  await a.getByRole("button", { name: "공유", exact: true }).click();
  await expect(a.getByText("함께 보는 기록")).toBeVisible();

  // 6) 이제 B는 사진을 본다(읽기만). 대표 사진도 카드에.
  await b.goto("/memories");
  const card = b.getByRole("link").filter({ hasText: "서울숲 산책" });
  await expect(card.locator("img")).toHaveCount(1);
  await card.click();
  const bImgs = b.locator("article img");
  await expect(bImgs).toHaveCount(2);
  await expect.poll(() => bImgs.first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(b.getByRole("button", { name: "사진 삭제" })).toHaveCount(0);
  expect((await bApi.from("photos").select("id")).data).toHaveLength(2);

  // 7) A의 사진함: 3장, 그중 기록에 안 붙은 1장
  await a.goto("/photos");
  await expect(a.locator("main img")).toHaveCount(3);
  await a.goto("/photos?filter=loose");
  await expect(a.locator("main img")).toHaveCount(1);
  // B는 A의 미분류 사진을 못 본다
  expect((await bApi.from("photos").select("id").is("memory_id", null)).data).toEqual([]);

  // 8) 다시 '나만 보기'로 → B에게서 사진이 즉시 사라진다
  await a.goto(memoryUrl);
  await a.getByRole("button", { name: "나만 보기로 바꾸기" }).click();
  await expect(a.getByText("나만 보기").first()).toBeVisible();
  expect((await bApi.from("photos").select("id")).data).toEqual([]);
});
