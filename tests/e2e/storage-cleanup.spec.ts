import { test, expect } from "@playwright/test";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { newUser, signUpAndConfirm } from "./helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

test.skip(!SERVICE_KEY || !CRON_SECRET, "SUPABASE_SERVICE_ROLE_KEY / CRON_SECRET 가 없으면 건너뜀");

test("삭제한 사진의 파일은 정리 작업이 Storage에서 실제로 지운다", async ({ browser, request }) => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY!, { auth: { persistSession: false } });

  // 정리 작업은 비밀값 없이 호출할 수 없다
  expect((await request.post("/api/cron/storage-cleanup")).status()).toBe(401);
  expect((await request.post("/api/cron/storage-cleanup", { headers: { authorization: "Bearer wrong-secret-wrong-secret" } })).status()).toBe(401);

  const a = await signUpAndConfirm(browser, newUser("Ana"));
  await a.goto("/couple");
  await a.getByRole("button", { name: "커플 공간 만들기" }).click();
  await a.goto("/photos/upload");
  await a.locator("#photo-input").setInputFiles(path.resolve(__dirname, "../fixtures/no-gps.jpg"));
  await a.getByRole("button", { name: "1장 저장" }).click();
  await a.waitForURL(/\/photos\?uploaded=1/);

  const img = a.locator("main img").first();
  const src = (await img.getAttribute("src"))!;
  const thumbPath = decodeURIComponent(new URL(src).pathname.split("/object/sign/couple-photos/")[1]);
  const mainPath = thumbPath.replace("_thumb.webp", ".webp");

  // 앱의 삭제는 파일도 바로 지우려 시도한다. 대기열 경로를 확인하려고 파일을 다시 만들어 둔다(정리 작업 검증용).
  await a.getByRole("button", { name: "사진 삭제" }).click();
  await expect(a.locator("main img")).toHaveCount(0);
  await admin.storage.from("couple-photos").upload(mainPath, new Blob(["x"], { type: "image/webp" }), { upsert: true });

  const res = await request.post("/api/cron/storage-cleanup", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  expect(res.status()).toBe(200);
  expect((await res.json()).removed).toBeGreaterThanOrEqual(2);
  expect((await admin.storage.from("couple-photos").download(mainPath)).data).toBeNull();
  expect((await admin.storage.from("couple-photos").download(thumbPath)).data).toBeNull();
});
