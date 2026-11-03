import { defineConfig, devices } from "@playwright/test";
import { e2eTestDirectory, frontendPath, frontendRoot } from "./shared";

const suites = {
  "crm-real": { testMatch: "crm-real.spec.ts", outputDir: "test-results/crm-real", timeout: 120_000 },
  "crm-ui": { testMatch: "crm-ui-real.spec.ts", outputDir: "test-results/crm-ui-real", timeout: 120_000 },
  "dashboard-connected": { testMatch: "dashboard-connected.spec.ts", outputDir: "test-results/dashboard-connected", timeout: 120_000 },
  "multicurrency-connected": { testMatch: "multicurrency-connected.spec.ts", outputDir: "test-results/multicurrency-connected", timeout: 120_000 },
  "realistic-demo": { testMatch: "realistic-demo-connected.spec.ts", outputDir: "test-results/realistic-demo", timeout: 120_000 },
  "studio-connected": { testMatch: "studio-first-visit.spec.ts", outputDir: "test-results/studio-connected", timeout: 120_000 },
  connections: { testMatch: "studio-connections.spec.ts", outputDir: "../../review-artifacts/studio-connections-pr1-20261022/browser", timeout: 180_000 },
} as const;

export type CrmSuite = keyof typeof suites;

export function createCrmConfig(suite: CrmSuite) {
  const api = process.env.UNICORECRM_TEST_API_BASE_URL?.trim();
  if (!api || !process.env.UNICORECRM_TEST_EMAIL || !process.env.UNICORECRM_TEST_PASSWORD) {
    throw new Error("Real CRM acceptance requires an isolated ApiHost and test credentials in environment variables.");
  }
  const profile = suites[suite];
  return defineConfig({
    testDir: e2eTestDirectory,
    testMatch: profile.testMatch,
    workers: 1,
    retries: 0,
    timeout: profile.timeout,
    outputDir: frontendPath(profile.outputDir),
    reporter: "list",
    use: {
      baseURL: "http://127.0.0.1:3039",
      ...devices["Desktop Chrome"],
      // Real CRM evidence must not retain bearer headers or sign-in bodies.
      trace: "off",
      video: "off",
      screenshot: "only-on-failure",
      actionTimeout: 15_000,
      navigationTimeout: 30_000,
    },
    webServer: {
      command: "npm run dev -- --host 127.0.0.1 --port 3039",
      cwd: frontendRoot,
      url: "http://127.0.0.1:3039",
      reuseExistingServer: false,
      env: { VITE_RUNTIME_MODE: "connected", VITE_API_BASE_URL: api },
      timeout: 120_000,
    },
  });
}
