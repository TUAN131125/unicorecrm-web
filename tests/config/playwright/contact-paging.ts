import { defineConfig, devices } from "@playwright/test";

import { chromiumLaunchOptions, e2eTestDirectory, frontendPath, frontendRoot, inheritedEnvironment } from "./shared";

export function createContactPagingConfig() {
  const api = process.env.UNICORECRM_TEST_API_BASE_URL;
  if (!api || !process.env.UNICORECRM_TEST_WORKSPACE_ID) throw new Error("Real API and workspace from disposable SQL harness required.");
  const environment = inheritedEnvironment();
  return defineConfig({
    testDir: e2eTestDirectory, testMatch: "contact-paging-kanban-real.spec.ts", workers: 1, retries: 0,
    reporter: "list", timeout: 180_000,
    outputDir: frontendPath(`${process.env.UNICORECRM_TEST_EVIDENCE_DIR}/paging-browser-playwright`),
    use: { baseURL: "http://127.0.0.1:3018", trace: "retain-on-failure", screenshot: "only-on-failure", video: "off" },
    projects: [{ name: "real-sql-chromium", use: { ...devices["Desktop Chrome"],
      launchOptions: chromiumLaunchOptions() } }],
    webServer: [{ cwd: frontendRoot, command: "npm run dev -- --host 127.0.0.1 --port 3018", url: "http://127.0.0.1:3018", reuseExistingServer: false,
      env: { ...environment, VITE_RUNTIME_MODE: "connected", DISABLE_HMR: "true", VITE_API_BASE_URL: api }, timeout: 120_000 }],
  });
}
