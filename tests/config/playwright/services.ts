import { defineConfig, devices } from "@playwright/test";
import { chromiumLaunchOptions, e2eTestDirectory, frontendRoot, inheritedEnvironment } from "./shared";

const profiles = {
  "ai-connected": {
    testMatch: "ai-connected.spec.ts",
    projectName: "ai-connected-chromium",
    serverTimeout: 180_000,
    missingApiMessage: "UNICORECRM_TEST_API_BASE_URL must point at the real CRM-AI ApiHost.",
  },
  "customer-health-connected": {
    testMatch: ["customer-health-connected.spec.ts"],
    projectName: "customer-health-connected-chromium",
    serverTimeout: 120_000,
    missingApiMessage: "UNICORECRM_TEST_API_BASE_URL is required for real Customer Health connected E2E.",
  },
  "support-connected": {
    testMatch: "support-connected.spec.ts",
    projectName: "support-connected-chromium",
    serverTimeout: 180_000,
    missingApiMessage: "UNICORECRM_TEST_API_BASE_URL must point at a real ApiHost for Support connected acceptance.",
  },
};

export type ServiceSuite = keyof typeof profiles;

/** External ApiHost only: this family never starts the connected stub fixture. */
export function createServiceConfig(suite: ServiceSuite) {
  const profile = profiles[suite];
  const apiBaseUrl = process.env.UNICORECRM_TEST_API_BASE_URL?.trim();
  if (!apiBaseUrl) throw new Error(profile.missingApiMessage);
  return defineConfig({
    testDir: e2eTestDirectory,
    testMatch: profile.testMatch,
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: suite === "customer-health-connected" ? [["list"]] : "list",
    use: {
      baseURL: "http://127.0.0.1:3000",
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
      video: "off",
    },
    projects: [{
      name: profile.projectName,
      use: { ...devices["Desktop Chrome"], launchOptions: chromiumLaunchOptions() },
    }],
    webServer: [{
      command: "npm run dev -- --host 127.0.0.1",
      cwd: frontendRoot,
      env: { ...inheritedEnvironment(), VITE_RUNTIME_MODE: "connected", VITE_AUTH_ADAPTER: "development", VITE_API_BASE_URL: apiBaseUrl },
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
      timeout: profile.serverTimeout,
    }],
  });
}
