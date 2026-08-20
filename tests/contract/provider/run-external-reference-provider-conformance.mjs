import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverFile = path.join(here, "reference-host", "serveReferenceProviderHost.mjs");
const runnerFile = path.join(here, "run-reference-provider-conformance.mjs");
const server = spawn(process.execPath, [serverFile], { stdio: ["ignore", "pipe", "inherit"] });
let baseUrl = "";
try {
  baseUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Reference provider host did not publish a base URL.")), 10_000);
    server.once("exit", (code) => reject(new Error(`Reference provider host exited before readiness (${code}).`)));
    server.stdout.setEncoding("utf8");
    server.stdout.on("data", (chunk) => {
      for (const line of chunk.split(/\r?\n/u)) {
        if (!line.startsWith("UNICORE_REFERENCE_PROVIDER_BASE_URL=")) continue;
        clearTimeout(timeout);
        resolve(line.slice("UNICORE_REFERENCE_PROVIDER_BASE_URL=".length));
      }
    });
  });
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runnerFile], {
      stdio: "inherit",
      env: { ...process.env, UNICORE_REFERENCE_PROVIDER_BASE_URL: baseUrl },
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`External reference conformance failed (${code}).`)));
  });
  console.log(`[external-reference-provider] PASS process-isolated conformance at ${baseUrl}`);
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => server.once("exit", resolve));
}
