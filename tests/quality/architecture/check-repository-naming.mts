import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import fs from "node:fs";
import path from "node:path";

interface NamingRule {
  id: string;
  pattern: RegExp;
}

interface Violation {
  kind: "path" | "content" | "root-markdown" | "documentation-command" | "documentation-gate" | "documentation-group" | "script-target" | "script-name";
  file: string;
  rule: string;
  line?: number;
  excerpt?: string;
}

const root = repositoryRoot;
const excludedDirectories = new Set([".git", ".cache", "coverage", "dist", "node_modules", ".agents", ".claude", ".ai-workflows", "design-reconstruction"]);
const rootMarkdownAllowlist = new Set(["AGENTS.md", "ARCHITECTURE.md", "README.md"]);
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".mts",
  ".scss",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const contentScanExclusions = new Set(["package-lock.json", "docs/quality/source-packaging.md"]);

const seriesA = ["p", "cr"].join("");
const seriesB = ["wa", "ve"].join("");
const seriesC = ["ba", "tch"].join("");
const urgentFixToken = ["hot", "fix"].join("");
const rootCauseFixToken = ["root", "fix"].join("");
const implementationSummaryToken = ["implementation", "summary"].join("[-_\\s]+");
const refactorProgressToken = ["refactor", "progress"].join("[-_\\s]+");

const namingRules: NamingRule[] = [
  {
    id: "delivery-series-pcr",
    pattern: new RegExp(`\\b${seriesA}(?:[-_\\s]*\\d+)\\b`, "giu"),
  },
  {
    id: "delivery-series-wave",
    pattern: new RegExp(`\\b${seriesB}(?:[-_\\s]*\\d+)\\b`, "giu"),
  },
  {
    id: "delivery-series-batch",
    pattern: new RegExp(`\\b${seriesC}(?:[-_\\s]*\\d+)\\b`, "giu"),
  },
  {
    id: "urgent-fix-marker",
    pattern: new RegExp(`\\b${urgentFixToken}\\b`, "giu"),
  },
  {
    id: "root-cause-fix-marker",
    pattern: new RegExp(`\\b${rootCauseFixToken}\\b`, "giu"),
  },
  {
    id: "worklog-summary-marker",
    pattern: new RegExp(`\\b${implementationSummaryToken}\\b`, "giu"),
  },
  {
    id: "worklog-progress-marker",
    pattern: new RegExp(`\\b${refactorProgressToken}\\b`, "giu"),
  },
];

const scriptStageRules: NamingRule[] = [
  ...namingRules,
  {
    id: "redesign-script-marker",
    pattern: /\bredesign\b/giu,
  },
];

const violations: Violation[] = [];
const files = walk(root);
let textFilesScanned = 0;
let markdownFilesChecked = 0;

for (const absoluteFile of files) {
  const relativeFile = toRelative(absoluteFile);
  scanPath(relativeFile);

  if (path.dirname(relativeFile) === "." && path.extname(relativeFile).toLowerCase() === ".md") {
    if (!rootMarkdownAllowlist.has(path.basename(relativeFile))) {
      violations.push({
        kind: "root-markdown",
        file: relativeFile,
        rule: "root markdown allowlist",
      });
    }
  }

  if (isScriptPolicyPath(relativeFile)) {
    scanScriptStageName(relativeFile, relativeFile);
  }

  if (!isTextFile(relativeFile) || contentScanExclusions.has(relativeFile)) {
    continue;
  }

  textFilesScanned += 1;
  const source = fs.readFileSync(absoluteFile, "utf8");
  scanContent(relativeFile, source);

  if (path.extname(relativeFile).toLowerCase() === ".md") {
    markdownFilesChecked += 1;
  }
}

const packageJsonPath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
  scripts?: Record<string, string>;
};
const packageScripts = packageJson.scripts ?? {};

for (const [name, command] of Object.entries(packageScripts)) {
  scanScriptStageName("package.json", name);
  validateScriptTargets(name, command);
}

const qualityManifest = JSON.parse(fs.readFileSync(path.join(root, "scripts/quality/quality-pipeline.json"), "utf8")) as {
  gates: Array<{ id: string }>;
  groups: Array<{ id: string }>;
};
validateDocumentedCommands(
  packageScripts,
  new Set(qualityManifest.gates.map((gate) => gate.id)),
  new Set(qualityManifest.groups.map((group) => group.id)),
);

if (violations.length > 0) {
  console.error(`Repository naming contract failed with ${violations.length} violation(s):`);
  for (const violation of violations) {
    const line = violation.line ? `:${violation.line}` : "";
    const excerpt = violation.excerpt ? ` -> ${violation.excerpt}` : "";
    console.error(`- [${violation.kind}] ${violation.file}${line}: ${violation.rule}${excerpt}`);
  }
  process.exit(1);
}

console.log(
  `Repository naming and documentation contracts: OK (${files.length} files, ${textFilesScanned} text files, ${markdownFilesChecked} markdown files)`,
);

function walk(directory: string): string[] {
  return walkFiles(directory, { excludeDirectory: (entryName) => excludedDirectories.has(entryName), sort: false });
}

function toRelative(absoluteFile: string): string {
  return path.relative(root, absoluteFile).split(path.sep).join("/");
}

function isTextFile(relativeFile: string): boolean {
  return textExtensions.has(path.extname(relativeFile).toLowerCase());
}

function isScriptPolicyPath(relativeFile: string): boolean {
  return relativeFile.startsWith("scripts/") || relativeFile === "package.json";
}

function scanPath(relativeFile: string): void {
  for (const rule of namingRules) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(relativeFile)) {
      violations.push({ kind: "path", file: relativeFile, rule: rule.id });
    }
  }
}

function scanContent(relativeFile: string, source: string): void {
  if (relativeFile === "AGENTS.md") {
    return;
  }

  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const rule of namingRules) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(line)) {
        violations.push({
          kind: "content",
          file: relativeFile,
          line: index + 1,
          rule: rule.id,
          excerpt: compact(line),
        });
      }
    }
  }
}

function scanScriptStageName(file: string, value: string): void {
  for (const rule of scriptStageRules) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(value)) {
      violations.push({
        kind: "script-name",
        file,
        rule: rule.id,
        excerpt: value,
      });
    }
  }
}

function validateDocumentedCommands(scripts: Record<string, string>, gateIds: Set<string>, groupIds: Set<string>): void {
  for (const absoluteFile of files) {
    const relativeFile = toRelative(absoluteFile);
    if (path.extname(relativeFile).toLowerCase() !== ".md") {
      continue;
    }
    const lines = fs.readFileSync(absoluteFile, "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const commandPattern = /\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g;
      for (const match of line.matchAll(commandPattern)) {
        const commandName = match[1];
        if (!Object.hasOwn(scripts, commandName)) {
          violations.push({
            kind: "documentation-command",
            file: relativeFile,
            line: index + 1,
            rule: "documented npm command must exist in package scripts",
            excerpt: commandName,
          });
        }
      }

      for (const match of line.matchAll(/\bnpm\s+run\s+quality:gate\s+--\s+--gate\s+([A-Za-z0-9._-]+)/g)) {
        const gateId = match[1];
        if (!gateIds.has(gateId)) {
          violations.push({
            kind: "documentation-gate",
            file: relativeFile,
            line: index + 1,
            rule: "documented quality gate must exist in the manifest",
            excerpt: gateId,
          });
        }
      }

      for (const match of line.matchAll(/\bnpm\s+run\s+quality:group\s+--\s+--groups?\s+([A-Za-z0-9._,-]+)/g)) {
        const documentedGroups = match[1].split(",").map((value) => value.trim()).filter(Boolean);
        for (const groupId of documentedGroups) {
          if (!groupIds.has(groupId)) {
            violations.push({
              kind: "documentation-group",
              file: relativeFile,
              line: index + 1,
              rule: "documented quality group must exist in the manifest",
              excerpt: groupId,
            });
          }
        }
      }
    }
  }
}

function validateScriptTargets(name: string, command: string): void {
  const targetPattern = /\b(?:node|tsx)\s+(scripts\/[A-Za-z0-9._/-]+)/g;
  for (const match of command.matchAll(targetPattern)) {
    const target = match[1];
    if (!fs.existsSync(path.join(root, target))) {
      violations.push({
        kind: "script-target",
        file: "package.json",
        rule: `package script target must exist for ${name}`,
        excerpt: target,
      });
    }
  }
}

function compact(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= 160 ? normalized : `${normalized.slice(0, 157)}...`;
}
