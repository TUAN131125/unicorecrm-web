import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { repositoryRoot } from "../../scripts/quality/core/repo-context.mjs";

const cli = path.join(repositoryRoot, "node_modules/@playwright/test/cli.js");
if (!fs.existsSync(cli)) {
  console.error("Connected browser acceptance is BLOCKED: @playwright/test is not installed.");
  process.exitCode = 2;
} else {
  const environment = { ...process.env };
  const systemChromium = "/usr/bin/chromium";
  if (!environment.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && fs.existsSync(systemChromium)) {
    environment.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = systemChromium;
  }
  const result = spawnSync(process.execPath, [cli, "test", "--config", "playwright.connected.config.ts", ...process.argv.slice(2)], {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
  });
  process.exitCode = result.status ?? 1;
}
