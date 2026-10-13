import { test, expect } from "@playwright/test";
import path from "node:path";
import { newUser, pairedCouple, signUpAndConfirm, writeMemory } from "./helpers";

const FIX = path.resolve(__dirname, "../fixtures");

test("발견: 기록에서 고른 것만 공개, 메타데이터 없는 이미지, 좋아요·저장·신고·차단, 숨김·삭제", async ({ browser }) => {
  const { a, b } = await pairedCouple(browser);
  const TITLE = `성수 산책 코스 ${Date.now().toString(36)}`; // 공유 DB에서 이전 실행 글과 구분
  const c = await signUpAndConfirm(browser, newUser("Cy")); // 다른 사용자(커플 없음)

  // 원본 기록: 나만 보기 + 비밀 메모 + 사진 2장 + 장소 2곳
  const memoryId = await writeMemory(a, { title: "성수 데이트", body: "비밀 메모 내용", date: "2026-05-17", share: "나만 보기" });
  await a.goto(`/photos/upload?memory=${memoryId}`);
  await a.locator("#photo-input").setInputFiles(["forest-1.jpg", "forest-2.jpg"].map((f) => path.join(FIX, f)));
  await a.getByRole("button", { name: /2장 추가/ }).click();
  await a.waitForURL(new RegExp(`/memories/${memoryId}`));
  for (const [name, coord] of [["성수역", "37.5446, 127.0559"], ["서울숲", "37.5444, 127.0374"]]) {
    await a.goto(`/memories/${memoryId}/places`);
    await a.getByText("좌표 직접 입력").click();
    await a.getByLabel("좌표").fill(coord);
    await a.getByRole("button", { name: "적용" }).click();
    await a.getByLabel("장소 이름").fill(name);
    await a.getByRole("button", { name: "장소 추가" }).click();
    await expect(a.getByText("장소를 추가했어요.")).toBeVisible();
  }

  // 1) 공개 화면: 기본값은 아무것도 공개하지 않음
  await a.goto(`/memories/${memoryId}`);
  await a.getByRole("link", { name: "공개 게시물로 만들기" }).click();
  const summary = a.getByTestId("publish-summary");
  await expect(summary).toContainText("사진: 0장");
  await expect(summary).toContainText("장소: 0곳");
  await expect(a.getByLabel("소개")).toHaveValue("");
  const publish = a.getByRole("button", { name: "공개하기" });
  await expect(publish).toBeDisabled();

  await a.getByLabel("제목", { exact: true }).fill(TITLE);
  await a.getByLabel("소개").fill("조용한 산책 코스 추천해요");
  await a.getByLabel("지역").fill("성수동");
  await a.getByLabel("사진 1 공개").check();
  await a.getByLabel("성수역 공개").check();
  await a.getByLabel("서울숲 공개").check();
  await expect(summary).toContainText("사진: 1장");
  await expect(summary).toContainText("장소: 2곳 (코스로 표시)");
  await expect(publish).toBeDisabled(); // 확인 체크 전
  await a.getByText("위 내용이 로그인한 다른 사용자에게 공개된다는 것을 확인했어요.").click();
  await publish.click();
  await a.waitForURL(/\/discover\/[0-9a-f-]{36}\?published=1/);
  const postUrl = a.url().split("?")[0];

  // 2) 공개 글: 고른 것만, 익명, 메타데이터 없는 이미지
  await expect(a.getByRole("heading", { name: TITLE })).toBeVisible();
  await expect(a.getByText(/익명의 커플/)).toBeVisible();
  await expect(a.getByText("비밀 메모 내용")).toHaveCount(0);
  const imgs = a.locator("article ul img");
  await expect(imgs).toHaveCount(1);
  const bytes = Buffer.from(await (await fetch((await imgs.first().getAttribute("src"))!)).arrayBuffer());
  expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
  expect(bytes.includes(Buffer.from("EXIF")) || bytes.includes(Buffer.from("Exif"))).toBe(false);
  await expect(a.getByTestId("map-pin")).toHaveCount(2);
  await expect(a.getByText("점선은 작성자가 정한 순서이며 실제 이동 경로가 아니에요.")).toBeVisible();

  // 3) 다른 사람: 공개 글은 보이지만 원본 기록은 여전히 비공개
  await c.goto("/discover");
  await expect(c.getByTestId("post-card").filter({ hasText: TITLE })).toBeVisible();
  await b.goto("/discover");
  await expect(b.getByTestId("post-card").filter({ hasText: TITLE })).toBeVisible();
  expect((await b.goto(`/memories/${memoryId}`))?.status()).toBe(404);

  // 4) 좋아요·저장
  await c.goto(postUrl);
  await c.getByRole("button", { name: /좋아요 0/ }).click();
  await expect(c.getByRole("button", { name: /좋아요 1/ })).toHaveAttribute("aria-pressed", "true");
  await c.getByRole("button", { name: "저장" }).click();
  await expect(c.getByRole("button", { name: "저장됨" })).toBeVisible();
  await c.goto("/discover/saved");
  await expect(c.getByTestId("post-card")).toHaveCount(1);

  // 5) 신고
  await c.goto(postUrl);
  await c.getByRole("button", { name: "신고" }).click();
  await c.getByLabel("내 개인정보·사진이 노출됨").check();
  await c.getByRole("button", { name: "신고하기" }).click();
  await expect(c.getByText(/신고를 접수했어요/)).toBeVisible();

  // 6) 차단 → C에게서 사라짐(직접 주소도 404), 저장 목록에서도
  await c.getByRole("button", { name: "이 작성자의 글 보지 않기" }).click();
  await c.getByRole("button", { name: "보지 않기", exact: true }).click();
  await c.waitForURL(/\/discover\?blocked=1/);
  await expect(c.getByTestId("post-card").filter({ hasText: TITLE })).toHaveCount(0);
  expect((await c.goto(postUrl))?.status()).toBe(404);
  await c.goto("/discover/saved");
  await expect(c.getByTestId("post-card")).toHaveCount(0);

  // 7) 작성자가 숨김 → B에게서 사라짐 / 삭제
  await a.goto(postUrl);
  await a.getByRole("button", { name: "숨기기" }).click();
  await expect(a.getByText("숨긴 글이에요. 나만 볼 수 있어요.")).toBeVisible();
  expect((await b.goto(postUrl))?.status()).toBe(404);
  await a.getByRole("button", { name: "삭제", exact: true }).click();
  await a.waitForURL(/\/discover\/mine\?deleted=1/);
  await expect(a.getByTestId("post-card")).toHaveCount(0);

  // 원본 기록은 그대로
  await a.goto(`/memories/${memoryId}`);
  await expect(a.getByRole("heading", { name: "성수 데이트" })).toBeVisible();
});
