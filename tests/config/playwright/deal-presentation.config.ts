import { defineConfig, devices } from "@playwright/test";
import { e2eTestDirectory, frontendPath, frontendRoot } from "./shared";

export default defineConfig({ testDir: e2eTestDirectory, testMatch: "deal-presentation.spec.ts", workers: 1, retries: 0, timeout: 180_000,
  outputDir: frontendPath("test-results/deal-presentation"), reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3041", trace: "off", screenshot: "only-on-failure" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 3041", cwd: frontendRoot, url: "http://127.0.0.1:3041", reuseExistingServer: false, env: { VITE_RUNTIME_MODE: "demo" }, timeout: 120_000 },
});
