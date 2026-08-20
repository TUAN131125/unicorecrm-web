import fs from "node:fs";
import path from "node:path";
import { readJson } from "./filesystem.mjs";
import { repositoryRoot, resolveFromRepository } from "./repo-context.mjs";

export const DEFAULT_QUALITY_MANIFEST_PATH = resolveFromRepository("scripts/quality/quality-pipeline.json");

export function loadQualityManifest(manifestPath = DEFAULT_QUALITY_MANIFEST_PATH) {
  return readJson(path.resolve(manifestPath));
}

export function validateQualityManifest(manifest, options = {}) {
  const errors = [];
  const checkEntries = options.checkEntries ?? true;
  if (manifest.schemaVersion !== 2) errors.push(`Expected quality manifest schemaVersion 2, received ${manifest.schemaVersion}.`);
  if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) errors.push("Quality manifest must declare groups.");
  if (!Array.isArray(manifest.gates) || manifest.gates.length === 0) errors.push("Quality manifest must declare gates.");

  const groupIds = new Set();
  const scheduledGateIds = [];
  for (const group of manifest.groups ?? []) {
    if (!group.id || groupIds.has(group.id)) errors.push(`Duplicate or missing quality group ID: ${group.id}`);
    groupIds.add(group.id);
    if (!Array.isArray(group.gates)) errors.push(`Quality group ${group.id} must declare gates.`);
    else scheduledGateIds.push(...group.gates);
  }

  const gateIds = new Set();
  const commandNames = new Set();
  for (const gate of manifest.gates ?? []) {
    if (!gate.id || gateIds.has(gate.id)) errors.push(`Duplicate or missing quality gate ID: ${gate.id}`);
    gateIds.add(gate.id);
    if (!gate.commandName || commandNames.has(gate.commandName)) errors.push(`Duplicate or missing quality command name: ${gate.commandName}`);
    commandNames.add(gate.commandName);
    if (!groupIds.has(gate.groupId)) errors.push(`Gate ${gate.id} references unknown group ${gate.groupId}.`);
    if (!gate.owner?.trim()) errors.push(`Gate ${gate.id} needs an owner.`);
    if (!gate.shardKey?.trim()) errors.push(`Gate ${gate.id} needs a shardKey.`);
    if (!Number.isInteger(gate.timeoutMs) || gate.timeoutMs < 1_000) errors.push(`Gate ${gate.id} has invalid timeoutMs.`);
    if (!Array.isArray(gate.requires)) errors.push(`Gate ${gate.id} must declare requires.`);
    if (!Array.isArray(gate.steps) || gate.steps.length === 0) errors.push(`Gate ${gate.id} must declare executable steps.`);
    for (const [index, step] of (gate.steps ?? []).entries()) {
      if (step.type === "node") {
        if (!step.entry) errors.push(`Gate ${gate.id} node step ${index} is missing entry.`);
        else if (checkEntries && !fs.existsSync(path.join(repositoryRoot, step.entry))) errors.push(`Gate ${gate.id} node entry does not exist: ${step.entry}`);
        if (!Array.isArray(step.nodeArgs) || !Array.isArray(step.args)) errors.push(`Gate ${gate.id} node step ${index} must declare nodeArgs and args.`);
      } else if (step.type === "tool") {
        if (!["typescript", "vite"].includes(step.tool)) errors.push(`Gate ${gate.id} has unsupported tool ${step.tool}.`);
        if (!Array.isArray(step.args)) errors.push(`Gate ${gate.id} tool step ${index} must declare args.`);
      } else {
        errors.push(`Gate ${gate.id} has unsupported step type ${step.type}.`);
      }
    }
  }

  const scheduledSet = new Set(scheduledGateIds);
  if (scheduledSet.size !== scheduledGateIds.length) errors.push("A quality gate is scheduled by more than one group.");
  for (const id of scheduledSet) if (!gateIds.has(id)) errors.push(`Scheduled quality gate has no definition: ${id}`);
  for (const id of gateIds) if (!scheduledSet.has(id)) errors.push(`Quality gate definition is not scheduled: ${id}`);
  const finalGroupId = manifest.groups?.at(-1)?.id;
  const buildGroupIndex = manifest.groups?.findIndex((group) => group.id === "build") ?? -1;
  if (finalGroupId === "acceptance") {
    if (buildGroupIndex !== (manifest.groups?.length ?? 0) - 2) errors.push("Production build must run immediately before external acceptance.");
  } else if (finalGroupId !== "build") {
    errors.push("Production build must be final unless an external acceptance group follows it.");
  }

  return { ok: errors.length === 0, errors, gateCount: gateIds.size, groupCount: groupIds.size };
}

export function indexQualityManifest(manifest) {
  return {
    groupsById: new Map(manifest.groups.map((group) => [group.id, group])),
    gatesById: new Map(manifest.gates.map((gate) => [gate.id, gate])),
    gatesByCommandName: new Map(manifest.gates.map((gate) => [gate.commandName, gate])),
  };
}
