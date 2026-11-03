import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { chromiumLaunchOptions, e2eTestDirectory, frontendPath, frontendRoot } from "./shared";

export function createQuoteCoreConfig() {
  const api = process.env.UNICORECRM_TEST_API_BASE_URL;
  if (api !== "http://127.0.0.1:5098" || !process.env.UNICORECRM_TEST_EMAIL || !process.env.UNICORECRM_TEST_PASSWORD || !process.env.UNICORECRM_TEST_DEAL_ID) throw new Error("Quote acceptance requires isolated ApiHost5098 and process-only control credentials/Deal.");
  const evidence = process.env.UNICORECRM_TEST_EVIDENCE_DIR || path.join(os.tmpdir(), "unicorecrm-quote-core-connected");
  return defineConfig({
    expect: { timeout: 30_000 },
    testDir: e2eTestDirectory, testMatch: "quote-core-connected.spec.ts", workers: 1, retries: 0, timeout: 300_000,
    outputDir: frontendPath(path.join(evidence, "test-results")), reporter: "list",
    use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3044", actionTimeout: 20_000, navigationTimeout: 30_000,
      trace: "off", video: "off", screenshot: "only-on-failure",
      launchOptions: chromiumLaunchOptions() },
    webServer: { cwd: frontendRoot, command: "npm run dev -- --host 127.0.0.1 --port 3044 --strictPort", url: "http://127.0.0.1:3044",
      reuseExistingServer: process.env.UNICORECRM_TEST_REUSE_VITE === "1", env: { VITE_RUNTIME_MODE: "connected", VITE_API_BASE_URL: api }, timeout: 120_000 },
  });
}
