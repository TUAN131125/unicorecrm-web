import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Browser fixtures must install DOM/storage before application singletons initialize. */
export async function runBrowserIsolated(url: string, run: () => Promise<void>): Promise<void> {
  if (!process.execArgv.some(argument => argument.includes("bootstrap-demo-application-composition"))) {
    await run();
    return;
  }
  // The canonical gate preloads the demo composition for non-browser tests. Run all
  // browser assertions in a fresh process so storage adapters bind to the test DOM.
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", fileURLToPath(url)], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Browser fixture failed: ${signal ?? code}`)));
  });
}
