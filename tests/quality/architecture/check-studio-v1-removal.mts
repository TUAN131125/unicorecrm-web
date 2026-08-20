import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = repositoryRoot;
for (const path of ["src/workspaces/studio/domain/studioConfiguration.types.ts", "src/workspaces/studio/application/studioConfigurationGateway.ts", "src/workspaces/studio/infrastructure/dev-memory/studioDemoSeed.ts", "scripts/check-studio-rebuild-boundary.mts", "scripts/check-workspace-settings-runtime.mts"]) assert.equal(existsSync(join(root, path)), false, `${path} must be removed`);
const forbidden = [/\bStudioConfigurationSnapshot\b/, /\bStudioAreaPayloadMap\b/, /\bsaveArea\s*\(/, /studio-demo-v2/, /unicore\.shipping\.pickup-locations\.v1/, /settings\/system/, /settings\/crm(?:["'/]|$)/];
for (const file of walkAllFiles(join(root, "src")).filter((item) => /\.[tj]sx?$/.test(item))) { const source = readFileSync(file, "utf8"); for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${relative(root, file)} contains retired Studio v1 term ${pattern}`); }
const scripts = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts;
assert.equal("check:studio-rebuild-boundary" in scripts, false);
assert.equal("test:workspace-settings-runtime" in scripts, false);
console.log("Studio v1 removal: PASS (retired gateway, snapshot, storage key, routes and gates are absent).");
