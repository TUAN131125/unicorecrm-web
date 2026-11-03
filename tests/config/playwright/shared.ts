import type { LaunchOptions } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const frontendRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
export const e2eTestDirectory = path.join(frontendRoot, "tests/e2e");

/** Resolve paths against the frontend, including when a config lives under tests/. */
export function frontendPath(relativePath: string): string {
  return path.resolve(frontendRoot, relativePath);
}

export function inheritedEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

/** Only profiles which already supported this override call this helper. */
export function chromiumLaunchOptions(): LaunchOptions | undefined {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return executablePath ? { executablePath } : undefined;
}
