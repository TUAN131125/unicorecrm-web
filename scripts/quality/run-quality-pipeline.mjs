import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_QUALITY_MANIFEST_PATH,
  indexQualityManifest,
  loadQualityManifest,
  validateQualityManifest,
} from "./core/quality-manifest.mjs";
import { repositoryRoot, resolveFromRepository } from "./core/repo-context.mjs";
import { stableShardIndex } from "./core/stable-hash.mjs";
import {
  createQualityReport,
  writeQualityJsonReport,
  writeQualityJunitReport,
} from "./core/reporting.mjs";

const nativeAuditPath = path.join(os.tmpdir(), `unicore-native-dialog-audit-${process.pid}.json`);
const nodeGateRunner = resolveFromRepository("scripts/quality/run-node-gate.mjs");

function parseArguments(argv) {
  const valueAfter = (name, fallback = null) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] ?? fallback : fallback;
  };
  const flags = new Set(argv);
  return {
    group: valueAfter("--group"),
    groups: valueAfter("--groups")?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
    gate: valueAfter("--gate"),
    shard: valueAfter("--shard", process.env.QUALITY_SHARD ?? null),
    manifestPath: path.resolve(valueAfter("--manifest", process.env.QUALITY_MANIFEST_PATH ?? DEFAULT_QUALITY_MANIFEST_PATH)),
    reportPath: valueAfter("--report", process.env.QUALITY_REPORT_PATH ?? null),
    junitPath: valueAfter("--junit", process.env.QUALITY_JUNIT_PATH ?? null),
    timeoutOverrideMs: Number(valueAfter("--timeout-ms", process.env.QUALITY_GATE_TIMEOUT_MS ?? "0")) || null,
    list: flags.has("--list"),
    withoutBuild: flags.has("--without-build"),
    withoutAcceptance: flags.has("--without-acceptance"),
    requireGate: flags.has("--require-gate"),
    requireGroup: flags.has("--require-group"),
  };
}

function parseShard(value) {
  if (!value) return null;
  const match = /^(\d+)\/(\d+)$/u.exec(value);
  if (!match) throw new Error(`Invalid shard ${value}; expected INDEX/TOTAL.`);
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (index < 1 || total < 1 || index > total) throw new Error(`Invalid shard ${value}.`);
  return { index, total };
}

function requirementAvailable(requirement) {
  if (requirement === "node") return { available: true, detail: process.version };
  if (requirement.startsWith("env:")) {
    const environmentName = requirement.slice("env:".length).trim();
    const value = environmentName ? process.env[environmentName]?.trim() : "";
    return value
      ? { available: true, detail: `Environment variable ${environmentName} is configured.` }
      : { available: false, detail: `Missing required environment variable ${environmentName || "<empty>"}` };
  }
  const requiredPath = requirement === "typescript"
    ? resolveFromRepository("node_modules/typescript/bin/tsc")
    : requirement === "vite"
      ? resolveFromRepository("node_modules/vite/bin/vite.js")
      : resolveFromRepository(`node_modules/${requirement}/package.json`);
  return fs.existsSync(requiredPath)
    ? { available: true, detail: requiredPath }
    : { available: false, detail: `Missing repository dependency ${requirement}` };
}

function resolveToolStep(step) {
  if (step.tool === "typescript") {
    return { command: process.execPath, args: [resolveFromRepository("node_modules/typescript/bin/tsc"), ...step.args] };
  }
  if (step.tool === "vite") {
    return { command: process.execPath, args: [resolveFromRepository("node_modules/vite/bin/vite.js"), ...step.args] };
  }
  throw new Error(`Unsupported quality tool: ${step.tool}`);
}

function executeStep(gate, step, environment) {
  if (step.type === "node") {
    const commandArgs = [
      nodeGateRunner,
      "--entry", step.entry,
      "--node-args-json", JSON.stringify(step.nodeArgs),
      "--args-json", JSON.stringify(step.args),
      "--grace-ms", String(gate.openHandleGraceMs ?? 250),
    ];
    const result = spawnSync(process.execPath, commandArgs, {
      cwd: repositoryRoot,
      env: environment,
      stdio: "inherit",
      timeout: gate.timeoutMs,
      killSignal: "SIGTERM",
    });
    if (result.error?.code === "ETIMEDOUT") return { status: "TIMEOUT", message: `Timed out after ${gate.timeoutMs}ms.` };
    if (result.error) return { status: "FAIL", message: result.error.message, diagnostics: result.error.stack ?? result.error.message };
    if (result.status === 86) return { status: "OPEN_HANDLE", message: "Gate retained active resources after entry completion." };
    if (result.status !== 0) return { status: "FAIL", message: `Node step failed with ${result.status ?? result.signal}.` };
    return { status: "PASS" };
  }

  const { command, args } = resolveToolStep(step);
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
    timeout: gate.timeoutMs,
    killSignal: "SIGTERM",
  });
  if (result.error?.code === "ETIMEDOUT") return { status: "TIMEOUT", message: `Timed out after ${gate.timeoutMs}ms.` };
  if (result.error) return { status: "FAIL", message: result.error.message, diagnostics: result.error.stack ?? result.error.message };
  if (result.status !== 0) return { status: "FAIL", message: `${step.tool} step failed with ${result.status ?? result.signal}.` };
  return { status: "PASS" };
}

function selectGates(manifest, options) {
  const { groupsById, gatesById, gatesByCommandName } = indexQualityManifest(manifest);
  if (options.group && options.groups.length > 0) throw new Error("Use either --group or --groups, not both.");
  if (options.gate && (options.group || options.groups.length > 0)) throw new Error("Use either a gate selector or group selectors, not both.");
  if (options.requireGate && !options.gate) throw new Error("quality:gate requires --gate <stable-gate-id>.");
  if (options.requireGroup && !options.group && options.groups.length === 0) throw new Error("quality:group requires --group <group-id> or --groups <id,id,...>.");

  let groups = manifest.groups;
  const selectedGroupIds = [...new Set(options.group ? [options.group] : options.groups)];
  if (selectedGroupIds.length > 0) {
    const unknown = selectedGroupIds.filter((id) => !groupsById.has(id));
    if (unknown.length > 0) throw new Error(`Unknown quality group(s): ${unknown.join(", ")}`);
    groups = selectedGroupIds.map((id) => groupsById.get(id));
  } else if (options.withoutBuild) {
    groups = groups.filter((group) => !["build", "acceptance"].includes(group.id));
  } else if (options.withoutAcceptance) {
    groups = groups.filter((group) => group.id !== "acceptance");
  }

  let selected = groups.flatMap((group) => group.gates.map((id) => ({ gate: gatesById.get(id), group })));
  if (options.gate) {
    const gate = gatesById.get(options.gate) ?? gatesByCommandName.get(options.gate);
    if (!gate) throw new Error(`Unknown quality gate: ${options.gate}`);
    const group = groupsById.get(gate.groupId);
    selected = [{ gate, group }];
  }

  const shard = parseShard(options.shard);
  if (shard) selected = selected.filter(({ gate }) => stableShardIndex(gate.shardKey, shard.total) === shard.index - 1);
  return { selected, shard };
}

function runGate(gate, group, displayIndex, total, environment, timeoutOverrideMs = null) {
  const startedAt = Date.now();
  const executableGate = timeoutOverrideMs ? { ...gate, timeoutMs: Math.max(1_000, timeoutOverrideMs) } : gate;
  console.log(`\n[quality ${displayIndex}/${total}] START ${group.id}/${gate.id} (${gate.commandName})`);
  const missing = gate.requires.map((requirement) => ({ requirement, ...requirementAvailable(requirement) })).filter((item) => !item.available);
  if (missing.length) {
    const message = missing.map((item) => item.detail).join(", ");
    console.error(`[quality ${displayIndex}/${total}] BLOCKED ${group.id}/${gate.id}: ${message}`);
    return { id: gate.id, commandName: gate.commandName, groupId: group.id, status: "BLOCKED", durationMs: Date.now() - startedAt, message };
  }

  for (const step of gate.steps) {
    const result = executeStep(executableGate, step, environment);
    if (result.status !== "PASS") {
      console.error(`[quality ${displayIndex}/${total}] ${result.status} ${group.id}/${gate.id}: ${result.message ?? ""}`);
      return { id: gate.id, commandName: gate.commandName, groupId: group.id, durationMs: Date.now() - startedAt, ...result };
    }
  }
  const durationMs = Date.now() - startedAt;
  console.log(`[quality ${displayIndex}/${total}] PASS ${group.id}/${gate.id} (${(durationMs / 1000).toFixed(1)}s)`);
  return { id: gate.id, commandName: gate.commandName, groupId: group.id, status: "PASS", durationMs, message: null };
}

function printSelection(selected) {
  let currentGroup = null;
  for (const { gate, group } of selected) {
    if (group.id !== currentGroup) {
      currentGroup = group.id;
      console.log(`${group.id}`);
    }
    console.log(`  - ${gate.id}\t${gate.commandName}\tshardKey=${gate.shardKey}`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = loadQualityManifest(options.manifestPath);
  const validation = validateQualityManifest(manifest);
  if (!validation.ok) throw new Error(`Quality manifest is invalid:\n- ${validation.errors.join("\n- ")}`);
  const { selected, shard } = selectGates(manifest, options);
  if (options.list) {
    printSelection(selected);
    return;
  }

  const startedAt = new Date().toISOString();
  const environment = { ...process.env, NATIVE_DIALOG_AUDIT_OUTPUT: nativeAuditPath, UNICORE_REPOSITORY_ROOT: repositoryRoot };
  const results = [];
  let stoppedAfterIndex = -1;
  for (const [index, { gate, group }] of selected.entries()) {
    results.push(runGate(gate, group, index + 1, selected.length, environment, options.timeoutOverrideMs));
    if (["FAIL", "TIMEOUT", "OPEN_HANDLE"].includes(results.at(-1).status)) {
      stoppedAfterIndex = index;
      break;
    }
  }
  if (stoppedAfterIndex >= 0) {
    for (const { gate, group } of selected.slice(stoppedAfterIndex + 1)) {
      results.push({
        id: gate.id,
        commandName: gate.commandName,
        groupId: group.id,
        status: "NOT_RUN",
        durationMs: 0,
        message: `Not run after ${results[stoppedAfterIndex].id} ${results[stoppedAfterIndex].status}.`,
      });
    }
  }
  const finishedAt = new Date().toISOString();
  const report = createQualityReport({
    manifest,
    selectedGroups: [...new Set(selected.map(({ group }) => group.id))],
    shard: shard ? `${shard.index}/${shard.total}` : null,
    startedAt,
    finishedAt,
    results,
  });
  if (options.reportPath) writeQualityJsonReport(path.resolve(options.reportPath), report);
  if (options.junitPath) writeQualityJunitReport(path.resolve(options.junitPath), report);
  console.log(`\n[quality] ${report.status} ${report.counts.PASS ?? 0}/${selected.length} passed across ${report.selectedGroups.length} groups (${(report.durationMs / 1000).toFixed(1)}s).`);
  if (report.status === "FAIL") process.exitCode = 1;
  else if (report.status === "BLOCKED") process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}).finally(() => {
  try { fs.rmSync(nativeAuditPath, { force: true }); } catch { /* best effort */ }
});
