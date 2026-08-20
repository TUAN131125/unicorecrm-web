import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { walkFiles } from "../quality/core/filesystem.mjs";
import { repositoryRoot } from "../quality/core/repo-context.mjs";

const scriptDirectory = path.join(repositoryRoot, "scripts/security");
export { repositoryRoot };
export const policyPath = path.join(scriptDirectory, "secret-policy.json");

const textExtensions = new Set([
  ".cjs", ".css", ".env", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".mts",
  ".svg", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);

export const SECRET_DETECTORS = [
  { id: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu },
  { id: "github-token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{20,255})\b/gu },
  { id: "openai-api-key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/gu },
  { id: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/gu },
  { id: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/gu },
  { id: "stripe-live-secret", pattern: /\bsk_live_[0-9A-Za-z]{16,}\b/gu },
  { id: "private-key-block", pattern: /-----BEGIN(?: RSA| EC| OPENSSH)? PRIVATE KEY-----[\s\S]*?-----END(?: RSA| EC| OPENSSH)? PRIVATE KEY-----/gu },
  { id: "browser-exposed-secret-name", pattern: /\bVITE_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|SIGNING_KEY|WEBHOOK_SECRET|CLIENT_SECRET|API_SECRET)\b/gu },
];

export function loadSecretPolicy(root = repositoryRoot) {
  const resolved = root === repositoryRoot ? policyPath : path.join(root, "scripts/security/secret-policy.json");
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

export function scanText(source, file = "<memory>") {
  const findings = [];
  for (const detector of SECRET_DETECTORS) {
    detector.pattern.lastIndex = 0;
    for (const match of source.matchAll(detector.pattern)) {
      const index = match.index ?? 0;
      const prefix = source.slice(0, index);
      const line = prefix.split(/\r?\n/u).length;
      const lastBreak = Math.max(prefix.lastIndexOf("\n"), prefix.lastIndexOf("\r"));
      findings.push({
        detector: detector.id,
        file,
        line,
        column: index - lastBreak,
        fingerprint: fingerprint(match[0]),
      });
    }
  }
  return findings;
}

export function scanRepository(root = repositoryRoot, policy = loadSecretPolicy(root)) {
  const excludedDirectories = new Set(policy.excludedDirectories ?? []);
  const files = walkFiles(root, { excludeDirectory: (entryName) => excludedDirectories.has(entryName), sort: false });
  const excludedFiles = new Set(policy.excludedFiles ?? []);
  const allowlist = new Set((policy.allowlist ?? []).map((entry) => allowlistKey(entry)));
  const findings = [];
  let scannedFiles = 0;

  for (const absoluteFile of files) {
    const relativeFile = normalizePath(path.relative(root, absoluteFile));
    if (excludedFiles.has(relativeFile) || !isTextFile(absoluteFile)) continue;
    scannedFiles += 1;
    const source = fs.readFileSync(absoluteFile, "utf8");
    for (const finding of scanText(source, relativeFile)) {
      if (!allowlist.has(allowlistKey(finding))) findings.push(finding);
    }
  }

  return { findings, scannedFiles };
}

export function formatFinding(finding) {
  return `${finding.file}:${finding.line}:${finding.column} [${finding.detector}] fingerprint=${finding.fingerprint}`;
}


function isTextFile(file) {
  const name = path.basename(file);
  return name.startsWith(".env") || textExtensions.has(path.extname(name).toLowerCase());
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function allowlistKey(entry) {
  return `${entry.detector}|${entry.file}|${entry.fingerprint}`;
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const result = scanRepository();
  if (result.findings.length > 0) {
    console.error(`[security-scan] FAIL — ${result.findings.length} finding(s) in ${result.scannedFiles} text files.`);
    for (const finding of result.findings) console.error(`- ${formatFinding(finding)}`);
    process.exitCode = 1;
  } else {
    console.log(`[security-scan] PASS — ${result.scannedFiles} text files scanned, zero unmanaged high-confidence findings.`);
  }
}
