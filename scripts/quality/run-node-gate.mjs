import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { repositoryRoot } from "./core/repo-context.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const entryRunner = path.join(scriptDirectory, "run-node-entry.mjs");

function parseArguments(argv) {
  const valueAfter = (name, fallback = null) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] ?? fallback : fallback;
  };
  const entry = valueAfter("--entry");
  if (!entry) throw new Error("[quality] Missing --entry for Node gate.");
  return {
    entry,
    nodeArgs: JSON.parse(valueAfter("--node-args-json", "[]")),
    args: JSON.parse(valueAfter("--args-json", "[]")),
    graceMs: Math.max(25, Number(valueAfter("--grace-ms", "250")) || 250),
  };
}

export async function runNodeGate(options) {
  const child = spawn(process.execPath, [...options.nodeArgs, entryRunner, options.entry, ...options.args], {
    cwd: repositoryRoot,
    env: { ...process.env },
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });

  return await new Promise((resolve) => {
    let completed = false;
    let openHandleTimer = null;
    let forceKillTimer = null;
    let resources = [];
    let diagnostics = null;
    let openHandleDetected = false;

    const terminateChild = () => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    };
    process.once("SIGTERM", terminateChild);
    process.once("SIGINT", terminateChild);

    const clearTimers = () => {
      if (openHandleTimer) clearTimeout(openHandleTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      process.off("SIGTERM", terminateChild);
      process.off("SIGINT", terminateChild);
    };

    child.on("message", (message) => {
      if (!message || typeof message !== "object") return;
      if (message.type === "quality-entry-error") {
        diagnostics = message.diagnostics ?? "Node gate entry failed.";
        return;
      }
      if (message.type !== "quality-entry-complete") return;
      completed = true;
      resources = Array.isArray(message.resources) ? message.resources.filter((name) => name !== "PipeWrap") : [];
      openHandleTimer = setTimeout(() => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        openHandleDetected = true;
        console.error(`[quality] OPEN_HANDLE ${options.entry}: ${resources.length ? resources.join(", ") : "active resources remained after completion"}`);
        child.kill("SIGTERM");
        forceKillTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        }, 1_000);
      }, options.graceMs);
    });

    child.on("error", (error) => {
      clearTimers();
      resolve({ status: "FAIL", exitCode: 1, signal: null, message: error.message, diagnostics: error.stack ?? error.message, resources });
    });

    child.on("exit", (code, signal) => {
      clearTimers();
      if (openHandleDetected) {
        resolve({
          status: "OPEN_HANDLE",
          exitCode: 86,
          signal,
          message: `Gate completed but retained active resources: ${resources.join(", ") || "unknown"}`,
          diagnostics,
          resources,
        });
        return;
      }
      if (code === 0 && completed) {
        resolve({ status: "PASS", exitCode: 0, signal: null, message: null, diagnostics: null, resources });
        return;
      }
      if (code === 0 && !completed) {
        resolve({ status: "FAIL", exitCode: 87, signal, message: "Gate exited before reporting entry completion.", diagnostics, resources });
        return;
      }
      resolve({
        status: "FAIL",
        exitCode: code ?? 1,
        signal,
        message: diagnostics ?? `Node gate failed with ${code ?? signal}`,
        diagnostics,
        resources,
      });
    });
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runNodeGate(options);
  if (result.status !== "PASS") process.exitCode = result.exitCode || 1;
}

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
