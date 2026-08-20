import fs from "node:fs";
import { ensureParentDirectory, writeJson } from "./filesystem.mjs";

export const QUALITY_REPORT_SCHEMA_VERSION = 1;

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function createQualityReport({ manifest, selectedGroups, shard, startedAt, finishedAt, results }) {
  const counts = results.reduce((output, result) => {
    output[result.status] = (output[result.status] ?? 0) + 1;
    return output;
  }, {});
  const status = counts.FAIL || counts.TIMEOUT || counts.OPEN_HANDLE
    ? "FAIL"
    : counts.BLOCKED
      ? "BLOCKED"
      : "PASS";
  return {
    schemaVersion: QUALITY_REPORT_SCHEMA_VERSION,
    manifestSchemaVersion: manifest.schemaVersion,
    status,
    startedAt,
    finishedAt,
    durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    selectedGroups,
    shard,
    counts,
    results,
  };
}

export function writeQualityJsonReport(filePath, report) {
  writeJson(filePath, report);
}

export function writeQualityJunitReport(filePath, report) {
  const failures = report.results.filter((result) => ["FAIL", "TIMEOUT", "OPEN_HANDLE"].includes(result.status)).length;
  const skipped = report.results.filter((result) => ["BLOCKED", "NOT_RUN"].includes(result.status)).length;
  const cases = report.results.map((result) => {
    const attributes = `classname="${xmlEscape(result.groupId)}" name="${xmlEscape(result.id)}" time="${(result.durationMs / 1000).toFixed(3)}"`;
    if (["BLOCKED", "NOT_RUN"].includes(result.status)) {
      return `  <testcase ${attributes}><skipped message="${xmlEscape(result.message ?? result.status)}" /></testcase>`;
    }
    if (["FAIL", "TIMEOUT", "OPEN_HANDLE"].includes(result.status)) {
      return `  <testcase ${attributes}><failure type="${xmlEscape(result.status)}" message="${xmlEscape(result.message ?? result.status)}">${xmlEscape(result.diagnostics ?? "")}</failure></testcase>`;
    }
    return `  <testcase ${attributes} />`;
  }).join("\n");
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="unicore-quality" tests="${report.results.length}" failures="${failures}" skipped="${skipped}" time="${(report.durationMs / 1000).toFixed(3)}">`,
    cases,
    "</testsuite>",
    "",
  ].join("\n");
  ensureParentDirectory(filePath);
  fs.writeFileSync(filePath, xml);
}
