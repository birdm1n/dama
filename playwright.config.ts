import { defineConfig, devices } from "@playwright/test";

/**
 * E2E: 실제 Supabase(Auth + PostgREST)가 떠 있어야 한다.
 *   npx supabase start
 *   (.env.local 설정 후) npm run test:e2e
 * 인증 메일은 Supabase 로컬 메일함(Mailpit, 54324)에서 읽는다.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Pixel 7"], // 모바일 우선
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
