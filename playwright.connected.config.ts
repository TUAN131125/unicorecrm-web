import { defineConfig, devices } from "@playwright/test";

const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const externalApiBaseUrl = process.env.UNICORECRM_TEST_API_BASE_URL?.trim();
const apiBaseUrl = externalApiBaseUrl || "http://127.0.0.1:4010";
const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);
const connectedFrontendEnvironment: Record<string, string> = {
  ...inheritedEnvironment,
  VITE_RUNTIME_MODE: "connected",
  VITE_AUTH_ADAPTER: "development",
  VITE_API_BASE_URL: apiBaseUrl,
};
const backendServer = externalApiBaseUrl
  ? []
  : [{
      command: "node tests/fixtures/connected-host/connectedApiTestHost.mjs --port 4010 --host 127.0.0.1",
      url: `${apiBaseUrl}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    }];

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "connected-backend.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.PLAYWRIGHT_DISABLE_VIDEO === "1" ? "off" : "retain-on-failure",
  },
  projects: [{
    name: "connected-chromium",
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined,
    },
  }],
  webServer: [
    ...backendServer,
    {
      command: "npm run dev -- --host 127.0.0.1",
      env: connectedFrontendEnvironment,
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
