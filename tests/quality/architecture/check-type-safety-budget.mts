import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const budgets = {
  anyKeywords: 207,
  explicitAnyAssertions: 29,
  nonNullAssertions: 60,
} as const;

const totals = {
  anyKeywords: 0,
  explicitAnyAssertions: 0,
  nonNullAssertions: 0,
};

function inspectFile(filePath: string): void {
  const source = fs.readFileSync(filePath, "utf8");
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
      (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
      node.type.kind === ts.SyntaxKind.AnyKeyword
    ) {
      totals.explicitAnyAssertions += 1;
    }
    if (ts.isNonNullExpression(node)) totals.nonNullAssertions += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function walk(directory: string): void {
  for (const filePath of walkAllFiles(directory, { include: (_filePath, entryName) => /\.tsx?$/u.test(entryName) })) inspectFile(filePath);
}

walk("src");
for (const [metric, budget] of Object.entries(budgets) as Array<[keyof typeof budgets, number]>) {
  assert.ok(totals[metric] <= budget, `${metric} exceeded its ratchet budget: ${totals[metric]} > ${budget}`);
}

console.log(`Type-safety budget PASS: any=${totals.anyKeywords}, as-any=${totals.explicitAnyAssertions}, non-null=${totals.nonNullAssertions}.`);
