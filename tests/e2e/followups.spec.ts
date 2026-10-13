import { test, expect } from "@playwright/test";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { newUser, pairedCouple, signUpAndConfirm, writeMemory } from "./helpers";

const FIX = path.resolve(__dirname, "../fixtures");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test("HEIC: 브라우저가 못 여는 HEIC도 변환해서 올린다 (메타데이터가 없으면 그렇다고 표시)", async ({ browser }) => {
  const a = await signUpAndConfirm(browser, newUser("Ana"));
  await a.goto("/couple");
  await a.getByRole("button", { name: "커플 공간 만들기" }).click();
  await a.goto("/photos/upload");
  // pillow-heif로 만든 합성 HEIC: 이미지는 정상이지만 EXIF는 exifr가 읽지 못하는 형태
  await a.locator("#photo-input").setInputFiles(path.join(FIX, "synthetic.heic"));
  const item = a.getByTestId("photo-item");
  await expect(item.getByText("읽는 중…")).toHaveCount(0, { timeout: 30_000 });
  await expect(item).not.toContainText("열 수 없어요");
  await expect(item.getByTestId("time-source")).toContainText("시각 정보 없음");
  await expect(item).toContainText("위치 정보 없음");
  await a.getByRole("button", { name: "1장 저장" }).click();
  await a.waitForURL(/\/photos\?uploaded=1/, { timeout: 30_000 });
  await expect(a.locator("main img")).toHaveCount(1);
});

test("사진함에서 기존 기록에 붙이기, 공유 기록이면 상대에게도 보인다는 안내", async ({ browser }) => {
  const { a, b } = await pairedCouple(browser);
  await a.goto("/photos/upload");
  await a.locator("#photo-input").setInputFiles(path.join(FIX, "forest-1.jpg"));
  await a.getByRole("button", { name: "1장 저장" }).click(); // 기본값: 사진만 보관
  await a.waitForURL(/\/photos\?uploaded=1/);

  const memoryId = await writeMemory(a, { title: "나중에 쓴 기록", date: "2026-05-17", share: "우리 둘 다 보기" });
  await a.goto(`/memories/${memoryId}`);
  await a.getByRole("link", { name: "사진함에서" }).click();
  await expect(a.getByRole("note")).toHaveCount(0);
  await a.getByLabel(/사진 선택/).first().check();
  await expect(a.getByRole("note")).toContainText("Ben님도 보게 돼요");
  await a.getByRole("button", { name: "1장 붙이기" }).click();
  await expect(a.getByText("사진 1장을 붙였어요.")).toBeVisible();

  await b.goto(`/memories/${memoryId}`);
  await expect(b.locator("article img")).toHaveCount(1);
});

test("공개 글 수정 + 지도 날짜 칩이 선택 날짜로 스크롤된다", async ({ browser }) => {
  const { a } = await pairedCouple(browser);
  // 날짜가 여러 개인 장소들
  for (const [i, date] of ["2026-01-05", "2026-02-05", "2026-03-05", "2026-04-05", "2026-05-05", "2026-06-05"].entries()) {
    const id = await writeMemory(a, { title: `기록${i}`, date, share: "나만 보기" });
    await a.goto(`/memories/${id}/places`);
    await a.getByText("좌표 직접 입력").click();
    await a.getByLabel("좌표").fill(`37.5${i}, 127.0${i}`);
    await a.getByRole("button", { name: "적용" }).click();
    await a.getByLabel("장소 이름").fill(`장소${i}`);
    await a.getByRole("button", { name: "장소 추가" }).click();
    await expect(a.getByText("장소를 추가했어요.")).toBeVisible();
    if (i === 0) {
      // 공개 글 만들고 수정
      await a.goto(`/discover/new?memory=${id}`);
      await a.getByLabel("제목", { exact: true }).fill(`원래 제목 ${Date.now()}`);
      await a.getByText("위 내용이 로그인한").click();
      await a.getByRole("button", { name: "공개하기" }).click();
      await a.waitForURL(/published=1/);
      await a.getByRole("link", { name: "수정" }).click();
      const t = `고친 제목 ${Date.now()}`;
      await a.getByLabel("제목").fill(t);
      await a.getByRole("button", { name: "수정 저장" }).click();
      await a.waitForURL(/edited=1/);
      await expect(a.getByRole("heading", { name: t })).toBeVisible();
    }
  }
  await a.goto("/map?date=2026-01-05"); // 최신순 목록의 맨 끝 날짜
  const nav = a.getByRole("navigation", { name: "날짜별 코스" });
  const chip = nav.locator("[aria-current]");
  await expect(chip).toBeInViewport();
});

test.describe("신고 검토", () => {
  test.skip(!SERVICE_KEY, "SUPABASE_SERVICE_ROLE_KEY가 없으면 운영자 지정을 할 수 없어 건너뜀");

  test("운영자만 대기열을 보고, 내리면 작성자에게만 '내려진 글'로 남는다", async ({ browser }) => {
    const { a } = await pairedCouple(browser);
    const reporter = await signUpAndConfirm(browser, newUser("Cy"));
    const modUser = newUser("Mod");
    const mod = await signUpAndConfirm(browser, modUser);

    // 일반 사용자는 운영 화면이 없는 것처럼 보인다
    expect((await reporter.goto("/admin/reports"))?.status()).toBe(404);

    // 공개 글 + 신고
    const memoryId = await writeMemory(a, { title: "신고될 기록", date: "2026-05-17", share: "나만 보기" });
    await a.goto(`/discover/new?memory=${memoryId}`);
    const title = `신고될 글 ${Date.now()}`;
    await a.getByLabel("제목", { exact: true }).fill(title);
    await a.getByText("위 내용이 로그인한").click();
    await a.getByRole("button", { name: "공개하기" }).click();
    await a.waitForURL(/published=1/);
    const postUrl = a.url().split("?")[0];
    await reporter.goto(postUrl);
    await reporter.getByRole("button", { name: "신고" }).click();
    await reporter.getByLabel("광고·스팸").check();
    await reporter.getByLabel("자세한 내용").fill("광고 같아요");
    await reporter.getByRole("button", { name: "신고하기" }).click();
    await expect(reporter.getByText(/신고를 접수했어요/)).toBeVisible();

    // 운영자 지정(service_role, 서버 전용) → 다시 로그인해야 JWT에 반영
    const admin = createClient(SUPABASE_URL, SERVICE_KEY!, { auth: { persistSession: false } });
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const modId = users.users.find((u) => u.email === modUser.email)!.id;
    await admin.auth.admin.updateUserById(modId, { app_metadata: { role: "admin" } });
    await mod.context().clearCookies();
    await mod.goto("/login");
    await mod.getByLabel("이메일").fill(modUser.email);
    await mod.getByLabel("비밀번호").fill(modUser.password);
    await mod.getByRole("button", { name: "로그인" }).click();
    await mod.waitForURL(/home/);

    await mod.getByRole("link", { name: "운영" }).click();
    const item = mod.getByTestId("report-item").filter({ hasText: title });
    await expect(item).toContainText("광고·스팸");
    await expect(item).toContainText("“광고 같아요”");
    await item.getByLabel("처리 메모").fill("스팸 확인");
    await item.getByRole("button", { name: "내리기" }).click();
    await expect(mod.getByText("글을 내렸어요.")).toBeVisible();
    await expect(mod.getByTestId("report-item").filter({ hasText: title })).toHaveCount(0);

    expect((await reporter.goto(postUrl))?.status()).toBe(404);
    await a.goto(postUrl);
    await expect(a.getByText(/운영 정책에 따라 내려진 글이에요/)).toBeVisible();
    await expect(a.getByRole("button", { name: "다시 공개" })).toHaveCount(0);
    await expect(a.getByRole("link", { name: "수정" })).toHaveCount(0);
  });
});
