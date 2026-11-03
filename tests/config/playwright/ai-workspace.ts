import { defineConfig, devices } from "@playwright/test";
import { e2eTestDirectory, frontendPath, frontendRoot } from "./shared";

export function createAiWorkspaceConfig() {
  const api = process.env.UNICORECRM_TEST_API_BASE_URL;
  if (!api) throw new Error("Isolated AI ApiHost required.");
  return defineConfig({
    testDir: e2eTestDirectory, testMatch: "ai-workspace-connected.spec.ts", workers: 1, retries: 0,
    outputDir: frontendPath(`${process.env.UNICORECRM_AI_EVIDENCE}/playwright`), reporter: "list",
    use: { baseURL: "http://127.0.0.1:3015", actionTimeout: 20000, navigationTimeout: 30000, trace: "off", screenshot: "only-on-failure", video: "off" },
    projects: [{ name: "ai-workspace-chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: { cwd: frontendRoot, command: "npm run dev -- --host 127.0.0.1 --port 3015", url: "http://127.0.0.1:3015", reuseExistingServer: false,
      env: { VITE_RUNTIME_MODE: "connected", VITE_AUTH_ADAPTER: "development", VITE_API_BASE_URL: api }, timeout: 180000 },
  });
}
