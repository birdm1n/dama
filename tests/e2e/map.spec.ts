import { test, expect } from "@playwright/test";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { pairedCouple, writeMemory } from "./helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

test("장소·지도: 좌표/지도/사진 위치로 장소 추가, 날짜별 코스(기록 순서 표시), 초안 장소는 상대에게 비공개", async ({ browser }) => {
  const { a, b, ub } = await pairedCouple(browser);

  const sharedId = await writeMemory(a, { title: "성수 데이트", date: "2026-05-17", share: "우리 둘 다 보기" });
  const draftId = await writeMemory(a, { title: "몰래 준비", date: "2026-05-17", share: "나만 보기" });

  // 1) 좌표 직접 입력으로 장소 추가
  await a.goto(`/memories/${sharedId}/places`);
  await expect(a.locator("[data-ready=true]")).toBeVisible({ timeout: 15_000 });
  await a.getByText("좌표 직접 입력").click();
  await a.getByLabel("좌표").fill("37.5446, 127.0559");
  await a.getByRole("button", { name: "적용" }).click();
  await expect(a.getByTestId("picked")).toContainText("37.54460, 127.05590 · 직접 입력한 좌표");
  await a.getByLabel("장소 이름").fill("성수역");
  await a.getByRole("button", { name: "장소 추가" }).click();
  await expect(a.getByText("장소를 추가했어요.")).toBeVisible();
  await expect(a.getByTestId("place-row")).toHaveCount(1);

  // 2) 지도를 눌러 장소 추가
  await expect(a.getByRole("button", { name: "장소 추가" })).toBeDisabled(); // 위치 미선택
  const map = a.getByRole("region", { name: "장소 고르기 지도" });
  const box = (await map.boundingBox())!;
  await a.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await expect(a.getByTestId("picked")).toContainText("지도에서 직접 고른 위치");
  await a.getByLabel("장소 이름").fill("서울숲");
  await a.getByRole("button", { name: "장소 추가" }).click();
  await expect(a.getByTestId("place-row")).toHaveCount(2);
  await expect(a.getByTestId("place-row").nth(1)).toContainText("서울숲");

  // 순서 바꾸기
  await a.getByRole("button", { name: "서울숲 위로" }).click();
  await expect(a.getByTestId("place-row").first()).toContainText("서울숲");
  await a.getByRole("button", { name: "서울숲 아래로" }).click();
  await expect(a.getByTestId("place-row").first()).toContainText("성수역");

  // 3) 초안 기록: 사진을 올리고 그 사진 위치로 장소 추가 (출처·정확도 유지)
  await a.goto(`/photos/upload?memory=${draftId}`);
  await a.locator("#photo-input").setInputFiles(path.resolve(__dirname, "../fixtures/forest-1.jpg"));
  await a.getByRole("button", { name: /1장 추가/ }).click();
  await a.waitForURL(new RegExp(`/memories/${draftId}`));
  await a.goto(`/memories/${draftId}/places`);
  await a.getByRole("button", { name: /사진 위치/ }).click();
  await expect(a.getByTestId("picked")).toContainText("사진 위치");
  await expect(a.getByTestId("picked")).toContainText("정확도 ±8m");
  await a.getByLabel("장소 이름").fill("선물가게");
  await a.getByRole("button", { name: "장소 추가" }).click();
  await expect(a.getByTestId("place-row")).toContainText("사진 정보 · ±8m");

  // 4) A의 지도: 그날 코스 3곳, 기록 순서 선 + 안내
  await a.goto("/map?date=2026-05-17");
  await expect(a.locator("[data-ready=true]")).toBeVisible({ timeout: 15_000 });
  await expect(a.getByTestId("map-pin")).toHaveCount(3);
  await expect(a.locator("[data-line-points]")).toHaveAttribute("data-line-points", "3");
  await expect(a.getByTestId("line-legend")).toHaveText(/기록 순서 \(실제 이동 경로 아님\)/);
  await expect(a.getByTestId("line-notice")).toContainText("실제로 이동한 경로가 아니라 기록한 순서");
  await expect(a.getByTestId("course-row")).toHaveText([/성수역/, /서울숲/, /선물가게/]);
  await expect(a.getByTestId("course-row").nth(2).getByLabel("나만 보기")).toBeVisible();

  // 5) B의 지도: 공유 기록의 장소만
  await b.goto("/map?date=2026-05-17");
  await expect(b.locator("[data-ready=true]")).toBeVisible({ timeout: 15_000 });
  await expect(b.getByTestId("map-pin")).toHaveCount(2);
  await expect(b.getByTestId("course-row")).toHaveText([/성수역/, /서울숲/]);
  await expect(b.getByText("선물가게")).toHaveCount(0);
  expect((await b.goto(`/memories/${sharedId}/places`))?.status()).toBe(404); // 남의 기록 장소 편집 불가

  const bApi = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  await bApi.auth.signInWithPassword({ email: ub.email, password: ub.password });
  const { data } = await bApi.from("memory_places").select("name").order("name");
  expect(data).toEqual([{ name: "서울숲" }, { name: "성수역" }]);
  const hijack = await bApi.from("memory_places").insert({
    memory_id: sharedId, couple_id: crypto.randomUUID(), seq: 9, name: "x", lat: 1, lng: 1, location_source: "manual",
  });
  expect(hijack.error).not.toBeNull();
});
