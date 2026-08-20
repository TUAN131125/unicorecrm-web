import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = repositoryRoot;
const rootConfigPath = path.join(root, "tsconfig.json");
const strictCoreConfigPath = path.join(root, "tsconfig.strict-core.json");
const packagePath = path.join(root, "package.json");

const protectedRoots = [
  "src/shared/application",
  "src/platform/api",
  "src/shared/domain",
  "src/platform/api",
  "src/shared/money",
  "src/shared/order-to-cash",
] as const;

const requiredIncludes = protectedRoots.map((directory) => `${directory}/**/*.ts`);

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

const rootConfig = readJson(rootConfigPath);
const rootCompilerOptions = (rootConfig.compilerOptions ?? {}) as Record<string, unknown>;
assert.equal(rootCompilerOptions.strict, true, "tsconfig.json must enable strict mode for all source files.");
assert.equal(
  rootCompilerOptions.useUnknownInCatchVariables,
  true,
  "tsconfig.json must keep catch variables typed as unknown.",
);

const strictCoreConfig = readJson(strictCoreConfigPath);
const strictCompilerOptions = (strictCoreConfig.compilerOptions ?? {}) as Record<string, unknown>;
assert.equal(strictCompilerOptions.strict, true, "The strict core config must enable strict mode.");
assert.equal(strictCompilerOptions.noImplicitAny, true, "The strict core config must reject implicit any.");
assert.equal(
  strictCompilerOptions.noUncheckedIndexedAccess,
  true,
  "The strict core config must protect indexed access.",
);
assert.equal(
  strictCompilerOptions.exactOptionalPropertyTypes,
  true,
  "The strict core config must distinguish omitted properties from explicit undefined.",
);
assert.equal(
  strictCompilerOptions.useUnknownInCatchVariables,
  true,
  "The strict core config must keep catch variables typed as unknown.",
);

const configuredIncludes = new Set((strictCoreConfig.include ?? []) as string[]);
for (const requiredInclude of requiredIncludes) {
  assert.ok(configuredIncludes.has(requiredInclude), `Missing strict-core include: ${requiredInclude}`);
}

const packageJson = readJson(packagePath);
const scripts = (packageJson.scripts ?? {}) as Record<string, string>;
assert.equal(scripts.lint, "node scripts/quality/run-quality-pipeline.mjs --group lint", "Lint must execute through the manifest-owned quality runner.");
assert.equal(scripts.typecheck, "node scripts/quality/run-quality-pipeline.mjs --group typecheck", "Typecheck must execute through the manifest-owned quality runner.");
assert.equal(scripts["typecheck:strict-core"], undefined, "Individual typecheck gate aliases must remain retired.");
const qualityPipeline = readJson(path.resolve(root, "scripts/quality/quality-pipeline.json")) as {
  groups: Array<{ id: string; gates: string[] }>;
};
assert.ok(
  qualityPipeline.groups.find((group) => group.id === "typecheck")?.gates.includes("quality.strict-type-regions"),
  "The typecheck group must include the strict-region guard.",
);

const totals = {
  files: 0,
  anyKeywords: 0,
  explicitAnyAssertions: 0,
  nonNullAssertions: 0,
  suppressionComments: 0,
};

function inspectFile(filePath: string): void {
  const source = fs.readFileSync(filePath, "utf8");
  totals.files += 1;
  totals.suppressionComments += (source.match(/@ts-(?:ignore|expect-error)/gu) ?? []).length;

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) totals.anyKeywords += 1;
    if (
      (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))
      && node.type.kind === ts.SyntaxKind.AnyKeyword
    ) {
      totals.explicitAnyAssertions += 1;
    }
    if (ts.isNonNullExpression(node)) totals.nonNullAssertions += 1;
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function walk(directory: string): void {
  assert.ok(fs.existsSync(directory), `Protected strict region is missing: ${path.relative(root, directory)}`);
  for (const filePath of walkAllFiles(directory, { include: (_filePath, entryName) => /\.tsx?$/u.test(entryName) })) inspectFile(filePath);
}

for (const protectedRoot of protectedRoots) walk(path.join(root, protectedRoot));

assert.ok(totals.files > 0, "Strict-region guard did not inspect any TypeScript files.");
assert.equal(totals.anyKeywords, 0, "Protected strict regions must not contain explicit any types.");
assert.equal(totals.explicitAnyAssertions, 0, "Protected strict regions must not use as any assertions.");
assert.equal(totals.nonNullAssertions, 0, "Protected strict regions must not use non-null assertions.");
assert.equal(totals.suppressionComments, 0, "Protected strict regions must not suppress TypeScript errors.");

console.log(
  `Strict type regions PASS: ${totals.files} files, strict global source, exact optional/indexed access boundaries, zero any/as-any/non-null/suppressions.`,
);
