import { defineConfig, devices } from "@playwright/test";

const apiBaseUrl = process.env.UNICORECRM_TEST_API_BASE_URL?.trim();
if (!apiBaseUrl) throw new Error("UNICORECRM_TEST_API_BASE_URL must point at the real CRM-AI ApiHost.");

const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "ai-connected.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure", screenshot: "only-on-failure", video: "off" },
  projects: [{ name: "ai-connected-chromium", use: { ...devices["Desktop Chrome"], launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined } }],
  webServer: [{
    command: "npm run dev -- --host 127.0.0.1",
    env: { ...inheritedEnvironment, VITE_RUNTIME_MODE: "connected", VITE_AUTH_ADAPTER: "development", VITE_API_BASE_URL: apiBaseUrl },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 180_000,
  }],
});
