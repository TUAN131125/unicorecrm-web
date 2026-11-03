import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { e2eTestDirectory, frontendPath, frontendRoot } from "./shared";

export function createQuoteListPipelineConfig() {
  const evidence = process.env.UNICORECRM_TEST_EVIDENCE_DIR;
  if (!evidence || process.env.UNICORECRM_TEST_API_BASE_URL !== "http://127.0.0.1:5098") throw new Error("Isolated connected acceptance environment required");
  return defineConfig({
    expect: { timeout: 30_000 }, testDir: e2eTestDirectory, testMatch: "quote-list-pipeline-connected.spec.ts", workers: 1, retries: 0, timeout: 240_000,
    outputDir: frontendPath(path.join(evidence, "test-results")), reporter: "list",
    use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3044", actionTimeout: 20_000, navigationTimeout: 30_000, trace: "off", video: "off", screenshot: "only-on-failure" },
    webServer: { cwd: frontendRoot, command: "npm run dev -- --host 127.0.0.1 --port 3044 --strictPort", url: "http://127.0.0.1:3044", reuseExistingServer: false,
      env: { VITE_RUNTIME_MODE: "connected", VITE_API_BASE_URL: "http://127.0.0.1:5098" }, timeout: 120_000 },
  });
}
