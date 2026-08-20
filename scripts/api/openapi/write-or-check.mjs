import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../quality/core/repo-context.mjs";
import { walkFiles } from "../../quality/core/filesystem.mjs";
import { assertNoBreakingChanges } from "./breaking-changes.mjs";
import { buildBreakingBaseline } from "./normalize.mjs";
import { openApiPaths, readJson } from "./load.mjs";

function absolute(relativePath) {
  return path.join(repositoryRoot, relativePath);
}

function writeFile(relativePath, content) {
  const target = absolute(relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function assertFile(relativePath, expected) {
  const target = absolute(relativePath);
  if (!fs.existsSync(target)) throw new Error(`Generated artifact is missing: ${relativePath}`);
  const actual = fs.readFileSync(target, "utf8");
  if (actual !== expected) throw new Error(`Generated artifact drifted: ${relativePath}. Run npm run api:generate.`);
}

export function generatedOutputs(artifacts) {
  return [
    [openApiPaths.checksum, artifacts.checksum],
    [openApiPaths.generatedManifest, artifacts.manifestSource],
    [openApiPaths.coverageLedger, artifacts.coverageSource],
    ...Object.entries(artifacts.renderedClients),
    ["src/platform/api/generated/index.ts", artifacts.indexSource],
    ["src/platform/api/contracts/generatedOpenApiRuntimeContract.ts", artifacts.runtimeContractSource],
    ["src/platform/api/contracts/generatedProductionCommandRegistry.ts", artifacts.productionCommandRegistrySource],
    ["src/platform/api/contracts/generatedProductionQueryRegistry.ts", artifacts.productionQueryRegistrySource],
    ["src/platform/api/catalog/generatedApiOperationCatalog.ts", artifacts.operationCatalogSource],
    ["docs/api/api-operation-catalog.json", artifacts.operationCatalogJsonSource],
    ["docs/backend-readiness/operation-contract-status.json", artifacts.operationContractStatusSource],
  ];
}

export function writeGeneratedArtifacts(artifacts) {
  for (const [file, content] of generatedOutputs(artifacts)) writeFile(file, content);
}

export function checkGeneratedArtifacts(artifacts, normalized) {
  for (const [file, content] of generatedOutputs(artifacts)) assertFile(file, content);
  if (!fs.existsSync(absolute(openApiPaths.breakingBaseline))) {
    throw new Error(`OpenAPI breaking baseline is missing: ${openApiPaths.breakingBaseline}.`);
  }
  const baseline = readJson(openApiPaths.breakingBaseline);
  assertNoBreakingChanges(baseline, buildBreakingBaseline(normalized));
  assertEndpointAuthority(normalized);
}

export function acceptBreakingBaseline(normalized) {
  const baseline = buildBreakingBaseline(normalized);
  writeFile(openApiPaths.breakingBaseline, `${JSON.stringify(baseline, null, 2)}\n`);
}

function stripComments(source) {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
}

export function findEndpointAuthorityViolations(normalized) {
  const generatedRoot = absolute("src/platform/api/generated");
  const generatedContractFiles = new Set([
    "src/platform/api/contracts/generatedProductionCommandRegistry.ts",
    "src/platform/api/contracts/generatedProductionQueryRegistry.ts",
    "src/platform/api/contracts/generatedOpenApiRuntimeContract.ts",
  ]);
  const approvedFiles = new Set([
    ...normalized.ownership.clients.flatMap((client) => Object.values(client.adapterByTag ?? {})),
    "src/platform/api/FetchHttpClient.ts",
  ]);
  const externalTransports = new Map((normalized.ownership.approvedExternalTransports ?? []).map((transport) => [transport.path, transport]));
  const apiPaths = normalized.operations.map((operation) => operation.route.split("{")[0]).filter((value) => value.length > 1);
  const files = walkFiles(absolute("src"), {
    excludeDirectory: (name) => ["node_modules", "dist", ".git", "coverage"].includes(name),
    sort: true,
  }).filter((file) => /\.(?:ts|tsx|mts|mjs)$/.test(file) && !file.startsWith(generatedRoot));
  const violations = [];
  for (const file of files) {
    const relative = path.relative(repositoryRoot, file).replaceAll(path.sep, "/");
    if (generatedContractFiles.has(relative)) continue;
    const source = stripComments(fs.readFileSync(file, "utf8"));
    const literalMatches = [...source.matchAll(/(?:path\s*:\s*|request\s*\(\s*)(["'`])\/(?!\/)([^"'`\n]*)\1/g)];
    if (literalMatches.length === 0) continue;
    const endpointMatches = literalMatches.filter((match) => apiPaths.some((prefix) => `/${match[2]}`.startsWith(prefix)));
    if (endpointMatches.length === 0) continue;
    const externalTransport = externalTransports.get(relative);
    if (externalTransport) {
      for (const match of endpointMatches) {
        const value = `/${match[2]}`;
        if (!externalTransport.routePrefixes.some((prefix) => value.startsWith(prefix))) {
          violations.push(`${relative}: external transport path is outside its approved prefixes: ${match[0].trim()}`);
        }
      }
      continue;
    }
    if (!approvedFiles.has(relative)) {
      for (const match of endpointMatches) violations.push(`${relative}: ${match[0].trim()}`);
      continue;
    }
    // Internal module adapters may not own routes that are already generated for their bounded context.
    for (const match of endpointMatches) violations.push(`${relative}: handwritten API path ${match[0].trim()}`);
  }
  return violations.sort();
}

export function assertEndpointAuthority(normalized) {
  const violations = findEndpointAuthorityViolations(normalized);
  if (violations.length > 0) {
    throw new Error(`Handwritten API endpoint authority remains outside generated clients:\n- ${violations.join("\n- ")}`);
  }
}
