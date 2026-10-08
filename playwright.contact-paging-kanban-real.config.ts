import { defineConfig, devices } from "@playwright/test";

const api = process.env.UNICORECRM_TEST_API_BASE_URL;
if (!api || !process.env.UNICORECRM_TEST_WORKSPACE_ID) throw new Error("Real API and workspace from disposable SQL harness required.");
const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
export default defineConfig({
  testDir: "./tests/e2e", testMatch: "contact-paging-kanban-real.spec.ts", workers: 1, retries: 0,
  reporter: "list", timeout: 180_000,
  outputDir: `${process.env.UNICORECRM_TEST_EVIDENCE_DIR}/paging-browser-playwright`,
  use: { baseURL: "http://127.0.0.1:3018", trace: "retain-on-failure", screenshot: "only-on-failure", video: "off" },
  projects: [{ name: "real-sql-chromium", use: { ...devices["Desktop Chrome"],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : undefined } }],
  webServer: [{ command: "npm run dev -- --host 127.0.0.1 --port 3018", url: "http://127.0.0.1:3018", reuseExistingServer: false,
    env: { ...environment, VITE_RUNTIME_MODE: "connected", DISABLE_HMR: "true", VITE_API_BASE_URL: api }, timeout: 120_000 }],
});
