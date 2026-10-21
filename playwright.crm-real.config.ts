import { defineConfig, devices } from "@playwright/test";

const api = process.env.UNICORECRM_TEST_API_BASE_URL?.trim();
if (!api || !process.env.UNICORECRM_TEST_EMAIL || !process.env.UNICORECRM_TEST_PASSWORD) {
  throw new Error("Real CRM acceptance requires an isolated ApiHost and test credentials in environment variables.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "crm-real.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  outputDir: "test-results/crm-real",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3039",
    ...devices["Desktop Chrome"],
    // Raw traces retain bearer headers and sign-in bodies. Collect screenshots and redacted
    // HTTP metadata explicitly, without writing credentials into evidence.
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 3039",
    url: "http://127.0.0.1:3039",
    reuseExistingServer: false,
    env: { VITE_RUNTIME_MODE: "connected", VITE_API_BASE_URL: api },
    timeout: 120_000,
  },
});
