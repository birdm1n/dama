import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { pairedCouple, writeMemory } from "./helpers";

test("기록: 초안은 작성자만, 공유는 명시적으로, 상대는 읽기만, 해제 후엔 내 기록만 보관·내보내기", async ({ browser }) => {
  const { a, b } = await pairedCouple(browser);

  const secretId = await writeMemory(a, {
    title: "깜짝 선물 계획", body: "아직 비밀", date: "2026-09-01", tags: "선물", share: "나만 보기",
  });
  await writeMemory(a, {
    title: "한강 산책", body: "노을이 예뻤다", date: "2026-09-10", tags: "한강, 산책", share: "우리 둘 다 보기",
  });
  await writeMemory(b, { title: "B의 첫 기록", date: "2026-08-15", share: "우리 둘 다 보기" });

  // A 타임라인: 셋 다 (자기 초안 포함), 월별 묶음
  await a.goto("/memories");
  await expect(a.getByRole("heading", { name: "2026년 9월" })).toBeVisible();
  await expect(a.getByRole("heading", { name: "2026년 8월" })).toBeVisible();
  for (const t of ["깜짝 선물 계획", "한강 산책", "B의 첫 기록"]) await expect(a.getByText(t)).toBeVisible();

  // B: A의 초안과 그 태그는 보이지 않는다. 주소를 알아도 404.
  await b.goto("/memories");
  await expect(b.getByText("한강 산책")).toBeVisible();
  await expect(b.getByText("깜짝 선물 계획")).toHaveCount(0);
  await expect(b.getByRole("link", { name: "#선물", exact: true })).toHaveCount(0);
  const res = await b.goto(`/memories/${secretId}`);
  expect(res?.status()).toBe(404);

  // 검색·태그 필터
  await b.goto("/memories");
  await b.getByRole("searchbox", { name: "기록 검색" }).fill("노을");
  await b.keyboard.press("Enter");
  await expect(b.getByText("한강 산책")).toBeVisible();
  await expect(b.getByText("B의 첫 기록")).toHaveCount(0);
  await b.goto("/memories");
  await b.getByRole("link", { name: "#한강", exact: true }).click();
  await expect(b).toHaveURL(/tag=/);
  await expect(b.getByText("한강 산책")).toBeVisible();
  await expect(b.getByText("B의 첫 기록")).toHaveCount(0);

  // B는 A의 공유 기록을 읽기만 할 수 있다
  await b.getByText("한강 산책").click();
  await expect(b.getByText(/작성자만 수정할 수 있어요/)).toBeVisible();
  await expect(b.getByRole("link", { name: "수정" })).toHaveCount(0);
  expect((await b.goto(`${b.url()}/edit`))?.status()).toBe(404);

  // A가 초안을 명시적으로 공유 → B에게 보인다
  await a.goto(`/memories/${secretId}`);
  await a.getByRole("button", { name: "공유하기…" }).click();
  await expect(a.getByText("Ben님도 이 기록을 보게 돼요.")).toBeVisible();
  await a.getByRole("button", { name: "공유", exact: true }).click();
  await expect(a.getByText("함께 보는 기록")).toBeVisible();
  await b.goto("/memories");
  await expect(b.getByText("깜짝 선물 계획")).toBeVisible();

  // B가 연결 해제 → 각자 자기 기록만 보관함에 남는다
  await b.goto("/couple");
  await b.getByRole("button", { name: "연결 해제…" }).click();
  await b.getByLabel(/계속하려면/).fill("연결 해제");
  await b.getByRole("button", { name: "연결 해제", exact: true }).click();
  await expect(b.getByText("연결을 해제했어요.")).toBeVisible();

  await a.goto("/couple/archive");
  await expect(a.getByText("깜짝 선물 계획")).toBeVisible();
  await expect(a.getByText("한강 산책")).toBeVisible();
  await expect(a.getByText("B의 첫 기록")).toHaveCount(0);

  const download = a.waitForEvent("download");
  await a.getByRole("link", { name: /내 기록 내보내기/ }).click();
  const file = await (await download).path();
  const json = JSON.parse(readFileSync(file!, "utf8"));
  expect(json.memories.map((m: { title: string }) => m.title).sort()).toEqual(["깜짝 선물 계획", "한강 산책"]);

  // 보관 기록은 읽기 전용: 수정 버튼 없음
  await a.getByText("한강 산책").click();
  await expect(a.getByText("보관 중 · 읽기 전용")).toBeVisible();
  await expect(a.getByRole("link", { name: "수정" })).toHaveCount(0);

  await b.goto("/couple/archive");
  await expect(b.getByText("B의 첫 기록")).toBeVisible();
  await expect(b.getByText("한강 산책")).toHaveCount(0);
});
