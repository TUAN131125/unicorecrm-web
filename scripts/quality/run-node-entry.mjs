import path from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot } from "./core/repo-context.mjs";

const [, , target, ...targetArgs] = process.argv;
if (!target) throw new Error("[quality] Missing Node gate target.");

const targetPath = path.resolve(repositoryRoot, target);
process.argv = [process.execPath, targetPath, ...targetArgs];

async function notify(message) {
  if (typeof process.send !== "function") return;
  await new Promise((resolve) => process.send(message, resolve));
  if (process.connected) process.disconnect();
}

try {
  await import(pathToFileURL(targetPath).href);
  await new Promise((resolve) => setImmediate(resolve));
  await notify({
    type: "quality-entry-complete",
    resources: typeof process.getActiveResourcesInfo === "function" ? process.getActiveResourcesInfo() : [],
  });
} catch (error) {
  const diagnostics = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(diagnostics);
  process.exitCode = 1;
  await notify({ type: "quality-entry-error", diagnostics });
}
