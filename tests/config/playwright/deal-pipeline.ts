import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { chromiumLaunchOptions, e2eTestDirectory, frontendPath, frontendRoot } from "./shared";

export function createDealPipelineConfig(suite: "deal-pipeline" | "deal-pipeline-review") {
  const api = process.env.UNICORECRM_TEST_API_BASE_URL;
  if (api !== "http://127.0.0.1:5098" || !process.env.UNICORECRM_TEST_EMAIL || !process.env.UNICORECRM_TEST_PASSWORD || !process.env.UNICORECRM_TEST_BUYER_ID) {
    throw new Error("Pipeline acceptance requires isolated ApiHost5098 and process-only test credentials/buyer ID.");
  }
  const evidence = process.env.UNICORECRM_TEST_EVIDENCE_DIR || path.join(os.tmpdir(), "unicorecrm-deal-pipeline-connected");
  return defineConfig({
    testDir: e2eTestDirectory,
    testMatch: suite === "deal-pipeline" ? "deal-pipeline-connected.spec.ts" : "deal-pipeline-final-review.spec.ts",
    workers: 1,
    retries: 0,
    timeout: 300_000,
    outputDir: frontendPath(path.join(evidence, "test-results")),
    reporter: "list",
    use: {
      ...devices["Desktop Chrome"],
      baseURL: "http://127.0.0.1:3042",
      actionTimeout: 15_000,
      navigationTimeout: 30_000,
      trace: "off",
      video: "off",
      screenshot: "only-on-failure",
      launchOptions: chromiumLaunchOptions(),
    },
    webServer: {
      command: "npm run dev -- --host 127.0.0.1 --port 3042 --strictPort",
      cwd: frontendRoot,
      url: "http://127.0.0.1:3042",
      reuseExistingServer: process.env.UNICORECRM_TEST_REUSE_VITE === "1",
      env: { VITE_RUNTIME_MODE: "connected", VITE_API_BASE_URL: api },
      timeout: 120_000,
    },
  });
}
