import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { chromiumLaunchOptions, e2eTestDirectory, frontendPath, frontendRoot } from "./shared";

const suites = {
  "quote-approval": "quote-approval-connected.spec.ts",
  "quote-acceptance": "quote-acceptance-connected.spec.ts",
  "quote-customer-response": "quote-customer-response-connected.spec.ts",
  "quote-delivery": "quote-delivery-connected.spec.ts",
  "quote-documents": "quote-documents-connected.spec.ts",
  "quote-identity": "quote-identity-connected.spec.ts",
  "quote-independent-review": "quote-independent-review-connected.spec.ts",
  "quote-lifecycle": "quote-lifecycle-connected.spec.ts",
  "quote-manual-source": "quote-manual-source-connected.spec.ts",
  "quote-proof": "quote-proof-connected.spec.ts",
  "quote-scanner": "quote-scanner-connected.spec.ts",
} as const;

export type QuoteApprovalSuite = keyof typeof suites;

/** These suites already inherited one approval config; their guards remain identical. */
export function createQuoteApprovalConfig(suite: QuoteApprovalSuite) {
  const api = process.env.UNICORECRM_TEST_API_BASE_URL;
  const evidence = process.env.UNICORECRM_TEST_EVIDENCE_DIR;
  if (api !== "http://127.0.0.1:5098" || !evidence || !process.env.UNICORECRM_TEST_EMAIL || !process.env.UNICORECRM_TEST_PASSWORD) {
    throw new Error("B1 acceptance requires isolated local API and process-only test credentials.");
  }
  return defineConfig({
    expect: { timeout: 30_000 },
    testDir: e2eTestDirectory,
    testMatch: suites[suite],
    workers: 1,
    retries: 0,
    timeout: 180_000,
    outputDir: frontendPath(path.join(evidence, "test-results")),
    reporter: "list",
    use: {
      ...devices["Desktop Chrome"],
      baseURL: "http://127.0.0.1:3044",
      actionTimeout: 20_000,
      trace: "off",
      video: "off",
      screenshot: "only-on-failure",
      launchOptions: chromiumLaunchOptions(),
    },
    webServer: {
      command: "npm run dev -- --host 127.0.0.1 --port 3044 --strictPort",
      cwd: frontendRoot,
      url: "http://127.0.0.1:3044",
      reuseExistingServer: false,
      env: { VITE_RUNTIME_MODE: "connected", VITE_API_BASE_URL: api },
      timeout: 120_000,
    },
  });
}
