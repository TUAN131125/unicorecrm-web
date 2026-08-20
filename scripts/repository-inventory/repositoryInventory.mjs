import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "../quality/core/filesystem.mjs";
import { repositoryRoot } from "../quality/core/repo-context.mjs";

export const ROOT = repositoryRoot;
export const INVENTORY_JSON_PATH = path.join(ROOT, "docs/quality/repository-inventory.json");
export const INVENTORY_MARKDOWN_PATH = path.join(ROOT, "docs/quality/repository-inventory.md");

const GENERATED_PATHS = new Set([
  "docs/quality/repository-inventory.json",
  "docs/quality/repository-inventory.md",
]);
const EXCLUDED_DIRECTORIES = new Set([".git", "node_modules", "dist", "coverage", "artifacts", ".agents", ".claude", ".ai-workflows", "design-reconstruction"]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs", ".json"];
const LARGE_FILE_THRESHOLD = 500;

const CRITICAL_JOURNEYS = [
  {
    id: "lead.create",
    name: "Create Lead",
    owners: ["leads"],
    sourceEvidence: [
      "src/modules/leads/application/commands/leadCommands.ts",
      "src/components/LeadForm.tsx",
    ],
    verificationGateIds: ["quality.lead-business-rules-contracts", "quality.sales-quick-create-contracts"],
  },
  {
    id: "lead.qualify-to-deal",
    name: "Qualify Lead to Deal",
    owners: ["leads", "deals", "lead-qualification"],
    sourceEvidence: [
      "src/workflows/lead-qualification",
      "src/workflows/lead-qualification/presentation/pages/LeadQualificationPage.tsx",
    ],
    verificationGateIds: ["quality.lead-lifecycle-contracts", "quality.pilot-end-to-end"],
  },
  {
    id: "quote.create",
    name: "Create Quote",
    owners: ["quotes"],
    sourceEvidence: [
      "src/modules/quotes/application/commands/quoteCommands.ts",
      "src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx",
    ],
    verificationGateIds: ["quality.quotes", "quality.quote-presentation-contracts"],
  },
  {
    id: "quote.accept",
    name: "Accept Quote",
    owners: ["quotes"],
    sourceEvidence: ["src/modules/quotes", "src/workflows/order-creation"],
    verificationGateIds: ["quality.quote-approval-delivery-contracts", "quality.quote-order-integrity-contracts"],
  },
  {
    id: "order.confirm",
    name: "Confirm Order",
    owners: ["orders", "payments", "order-confirmation"],
    sourceEvidence: ["src/workflows/order-confirmation", "src/modules/orders"],
    verificationGateIds: ["quality.order-creation-contracts", "quality.order-operations-frontend-contracts"],
  },
  {
    id: "invoice.issue",
    name: "Issue Invoice",
    owners: ["invoices"],
    sourceEvidence: ["src/modules/invoices"],
    verificationGateIds: ["quality.invoice-domain-contracts", "quality.order-to-cash-api-contracts"],
  },
  {
    id: "payment.record",
    name: "Record Payment",
    owners: ["payments"],
    sourceEvidence: ["src/modules/payments"],
    verificationGateIds: ["quality.payment-workflow-contracts", "quality.payment-allocation-contracts"],
  },
  {
    id: "shipping.book",
    name: "Create Shipping Booking",
    owners: ["shipping", "order-shipping-booking"],
    sourceEvidence: ["src/modules/shipping", "src/workflows/order-shipping-booking"],
    verificationGateIds: ["quality.shipping-create-page-contracts", "quality.shipping-returns-contracts"],
  },
  {
    id: "return.process",
    name: "Process Return",
    owners: ["returns", "shipping", "payments"],
    sourceEvidence: ["src/modules/returns", "src/workflows/return-resolution-evidence"],
    verificationGateIds: ["quality.shipping-returns-contracts", "quality.return-credit-refund-contracts"],
  },
  {
    id: "support.manage-case",
    name: "Create and Process Support Case",
    owners: ["support"],
    sourceEvidence: ["src/modules/support"],
    verificationGateIds: ["quality.support", "quality.work-operations-ux"],
  },
  {
    id: "task.create-related",
    name: "Create Related Task",
    owners: ["tasks", "work-activation"],
    sourceEvidence: ["src/modules/tasks", "src/workflows/work-activation"],
    verificationGateIds: ["quality.work-operations-ux", "quality.record-ownership-contracts"],
  },
];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function relativePath(absolutePath) {
  return toPosix(path.relative(ROOT, absolutePath));
}

function listFiles(directory = ROOT) {
  return walkFiles(directory, {
    excludeDirectory: (entryName) => EXCLUDED_DIRECTORIES.has(entryName),
  }).sort((a, b) => relativePath(a).localeCompare(relativePath(b)));
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

const canonicalByteCache = new Map();

function readCanonicalBytes(file) {
  const cached = canonicalByteCache.get(file);
  if (cached) return cached;

  const raw = fs.readFileSync(file);

  // Preserve binary files exactly. Normalize text line endings so
  // Windows CRLF and Linux LF produce the same inventory evidence.
  const canonical = raw.includes(0)
    ? raw
    : Buffer.from(
        raw.toString("utf8").replace(/\r\n?/g, "\n"),
        "utf8",
      );

  canonicalByteCache.set(file, canonical);
  return canonical;
}

function lineCount(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function ownerFor(filePath) {
  const parts = filePath.split("/");
  if (parts[0] === "src" && parts[1] === "modules" && parts[2]) return parts[2];
  if (parts[0] === "src" && parts[1] === "workflows" && parts[2]) return `workflow:${parts[2]}`;
  if (parts[0] === "src" && parts[1] === "platform" && parts[2]) return `platform:${parts[2]}`;
  if (parts[0] === "src" && parts[1] === "workspaces" && parts[2]) return `workspace:${parts[2]}`;
  if (parts[0] === "src" && parts[1] === "features" && parts[2]) return `feature:${parts[2]}`;
  if (parts[0] === "src" && parts[1]) return `shared:${parts[1]}`;
  if (parts[0] === "scripts") return "tooling";
  if (parts[0] === "tests") return "test";
  if (parts[0] === "docs") return "documentation";
  return "repository";
}

function findMatchingDelimiter(source, startIndex, openChar = "{", closeChar = "}") {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractObjectBody(source, declarationPattern) {
  const match = declarationPattern.exec(source);
  if (!match) return "";
  const start = source.indexOf("{", match.index);
  if (start < 0) return "";
  const end = findMatchingDelimiter(source, start);
  return end < 0 ? "" : source.slice(start + 1, end);
}

function parseStringMap(filePath, constantName) {
  const source = readText(path.join(ROOT, filePath));
  const body = extractObjectBody(source, new RegExp(`(?:export\\s+)?const\\s+${constantName}\\s*=\\s*\\{`, "m"));
  const entries = [];
  for (const match of body.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:\s*["']([^"']+)["']/gm)) {
    entries.push({ key: match[1], value: match[2] });
  }
  return entries;
}

function parseWorkspaceFlags() {
  const source = readText(path.join(ROOT, "src/platform/workspace-config/workspaceConfig.types.ts"));
  const body = extractObjectBody(source, /export\s+type\s+CrmModuleVisibilityConfig\s*=\s*\{/m);
  const flags = [];
  for (const match of body.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\??\s*:\s*boolean\s*;/gm)) {
    flags.push({ key: match[1], optional: match[0].includes("?") });
  }
  return flags;
}

function extractArrayBody(source, propertyName) {
  const match = new RegExp(String.raw`\b${propertyName}\s*:\s*\[`, "m").exec(source);
  if (!match) return "";
  const start = source.indexOf("[", match.index);
  if (start < 0) return "";
  const end = findMatchingDelimiter(source, start, "[", "]");
  return end < 0 ? "" : source.slice(start + 1, end);
}

function parseManifestItems(body) {
  return [...body.matchAll(/\bid\s*:\s*["']([^"']+)["'][\s\S]{0,220}?\bpath\s*:\s*ROUTE_KEYS\.([A-Z0-9_]+)/g)]
    .map((match) => ({ id: match[1], routeKey: match[2] }));
}

function parseModuleManifests() {
  const moduleRoot = path.join(ROOT, "src/modules");
  if (!fs.existsSync(moduleRoot)) return [];
  const modules = [];
  for (const directory of fs.readdirSync(moduleRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const manifest = path.join(moduleRoot, directory.name, "manifest.ts");
    if (!fs.existsSync(manifest)) continue;
    const source = readText(manifest);
    const key = source.match(/\bkey\s*:\s*["']([^"']+)["']/)?.[1] ?? directory.name;
    const workspace = source.match(/\bworkspace\s*:\s*["']([^"']+)["']/)?.[1] ?? "unknown";
    const routes = parseManifestItems(extractArrayBody(source, "routes"));
    const navigation = parseManifestItems(extractArrayBody(source, "navigation"));
    modules.push({
      key,
      directory: directory.name,
      workspace,
      manifest: relativePath(manifest),
      routes,
      navigation,
    });
  }
  return modules.sort((a, b) => a.key.localeCompare(b.key));
}

function parseImports(source) {
  const specifiers = new Set();
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function resolveImport(fromFile, specifier, knownFiles) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(ROOT, "src", specifier.slice(2));
  else if (specifier.startsWith("./") || specifier.startsWith("../")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  const candidates = [base];
  for (const extension of RESOLVE_EXTENSIONS) candidates.push(`${base}${extension}`);
  for (const extension of RESOLVE_EXTENSIONS) candidates.push(path.join(base, `index${extension}`));
  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (knownFiles.has(normalized)) return normalized;
  }
  return null;
}

function buildImportGraph(allFiles) {
  const codeFiles = allFiles.filter((file) => CODE_EXTENSIONS.has(path.extname(file)));
  const knownFiles = new Set(codeFiles.map((file) => path.normalize(file)));
  const graph = new Map();
  for (const file of codeFiles) {
    const dependencies = [];
    for (const specifier of parseImports(readText(file))) {
      const resolved = resolveImport(file, specifier, knownFiles);
      if (resolved) dependencies.push(resolved);
    }
    graph.set(path.normalize(file), [...new Set(dependencies)].sort());
  }
  return graph;
}

function reachableFrom(entries, graph) {
  const reached = new Set();
  const queue = entries.filter((entry) => graph.has(path.normalize(entry))).map((entry) => path.normalize(entry));
  while (queue.length) {
    const current = queue.pop();
    if (!current || reached.has(current)) continue;
    reached.add(current);
    for (const dependency of graph.get(current) ?? []) {
      if (!reached.has(dependency)) queue.push(dependency);
    }
  }
  return reached;
}

function findCircularDependencies(graph) {
  let index = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  const strongConnect = (node) => {
    indices.set(node, index);
    lowLinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const neighbor of graph.get(node) ?? []) {
      if (!indices.has(neighbor)) {
        strongConnect(neighbor);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(neighbor)));
      } else if (onStack.has(neighbor)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(neighbor)));
      }
    }

    if (lowLinks.get(node) === indices.get(node)) {
      const component = [];
      let current;
      do {
        current = stack.pop();
        onStack.delete(current);
        component.push(current);
      } while (current !== node);
      const hasSelfLoop = component.length === 1 && (graph.get(component[0]) ?? []).includes(component[0]);
      if (component.length > 1 || hasSelfLoop) components.push(component);
    }
  };

  for (const node of graph.keys()) if (!indices.has(node)) strongConnect(node);
  return components
    .map((component) => component.map(relativePath).sort())
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function extractExportedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/\bexport\s+(?:declare\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  for (const match of source.matchAll(/\bexport\s*\{([\s\S]*?)\}(?:\s*from\s*["'][^"']+["'])?\s*;?/g)) {
    for (const item of match[1].split(",")) {
      const cleaned = item.replace(/\btype\s+/g, "").trim();
      if (!cleaned) continue;
      const alias = cleaned.match(/\bas\s+([A-Za-z_$][\w$]*)$/)?.[1];
      const direct = cleaned.match(/^([A-Za-z_$][\w$]*)/)?.[1];
      if (alias || direct) names.add(alias ?? direct);
    }
  }
  return [...names].sort();
}

function collectPublicExports(allFiles) {
  const boundaries = allFiles.filter((file) => {
    const relative = relativePath(file);
    if (!SOURCE_EXTENSIONS.has(path.extname(file))) return false;
    return /^src\/(modules|workflows|platform|shared|entities)\/[^/]+\/index\.(ts|tsx)$/.test(relative)
      || /^src\/(modules|workflows)\/[^/]+\/public\//.test(relative);
  });
  return boundaries.map((file) => {
    const source = readText(file);
    const reExportSources = [...source.matchAll(/\bexport\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/g)]
      .map((match) => match[1]);
    const statementCount = (source.match(/\bexport\b/g) ?? []).length;
    return {
      path: relativePath(file),
      owner: ownerFor(relativePath(file)),
      statementCount,
      exportedNames: extractExportedNames(source),
      reExportSources: [...new Set(reExportSources)].sort(),
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function operationForLine(line) {
  if (/resourceKey/.test(line)) return "workspace-resource";
  if (/setItem|\.set\s*\(/.test(line)) return "write";
  if (/getItem|\.get\s*\(/.test(line)) return "read";
  if (/removeItem|\.remove\s*\(/.test(line)) return "remove";
  if (/storageKey|STORAGE_KEY|StorageKey/.test(line)) return "declaration";
  return "reference";
}

function collectPersistenceEntries(allFiles) {
  const entries = [];
  const seen = new Set();
  const storageSignal = /storageKey|resourceKey|localStorage|sessionStorage|StorageKey|STORAGE_KEY|\.getItem\s*\(|\.setItem\s*\(|\.removeItem\s*\(|\bstorage\.(?:get|set|remove)\s*\(/;
  for (const file of allFiles.filter((candidate) => SOURCE_EXTENSIONS.has(path.extname(candidate)))) {
    const relative = relativePath(file);
    const lines = readText(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!storageSignal.test(line)) return;
      const literals = [...line.matchAll(/(["'`])([^"'`]+)\1/g)].map((match) => match[2]);
      for (const value of literals) {
        const keyLike = /[_:${}-]|unicore|centrix|workspace|storage|session|config|preference|draft|guidance|resourceKey/i.test(value)
          || /resourceKey/.test(line);
        if (!keyLike || value.length < 3 || value.startsWith("@/")) continue;
        const id = `${relative}:${index + 1}:${value}`;
        if (seen.has(id)) continue;
        seen.add(id);
        entries.push({
          keyPattern: value,
          operation: operationForLine(line),
          owner: ownerFor(relative),
          path: relative,
          line: index + 1,
          browserGlobal: /localStorage|sessionStorage/.test(line),
        });
      }
    });
  }
  return entries.sort((a, b) => a.keyPattern.localeCompare(b.keyPattern) || a.path.localeCompare(b.path) || a.line - b.line);
}

function infrastructureKind(source, relative) {
  if (/Http|fetch\s*\(|ApiAdapter|api\//i.test(source) || /\/http\//i.test(relative)) return "http-api";
  if (/localStorage|BrowserStorage|Browser.*Repository|PreferenceStore/i.test(source + relative)) return "browser-storage";
  if (/Memory|InMemory|memory/i.test(source + relative)) return "in-memory";
  if (/IndexedDB|indexedDB/i.test(source)) return "indexed-db";
  return "generic";
}

function collectRepositories(allFiles) {
  const entries = [];
  for (const file of allFiles.filter((candidate) => SOURCE_EXTENSIONS.has(path.extname(candidate)))) {
    const relative = relativePath(file);
    const source = readText(file);
    const nameSignal = /(?:Repository|Store|Adapter)/.test(path.basename(file));
    const declarationNames = [...source.matchAll(/\b(?:export\s+)?(?:class|interface|const|function)\s+([A-Za-z_$][\w$]*(?:Repository|Store|Adapter)[A-Za-z_$\w]*)/g)]
      .map((match) => match[1]);
    if (!nameSignal && declarationNames.length === 0) continue;
    entries.push({
      path: relative,
      owner: ownerFor(relative),
      layer: relative.includes("/domain/") ? "domain" : relative.includes("/application/") ? "application" : relative.includes("/infrastructure/") ? "infrastructure" : relative.includes("/presentation/") ? "presentation" : "other",
      kind: infrastructureKind(source, relative),
      declarations: [...new Set(declarationNames)].sort(),
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function collectBrowserEvents(allFiles) {
  const entries = [];
  const seen = new Set();
  for (const file of allFiles.filter((candidate) => SOURCE_EXTENSIONS.has(path.extname(candidate)))) {
    const relative = relativePath(file);
    const lines = readText(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!/CustomEvent|addEventListener|removeEventListener|dispatchEvent/.test(line)) return;
      const literals = [...line.matchAll(/(["'`])([^"'`]+)\1/g)].map((match) => match[2]);
      for (const eventName of literals) {
        const custom = /CustomEvent/.test(line);
        const meaningful = custom || /[:._-]|storage|hashchange|popstate|online|offline|visibilitychange|beforeunload/i.test(eventName);
        if (!meaningful || eventName.startsWith("@/")) continue;
        const id = `${relative}:${index + 1}:${eventName}`;
        if (seen.has(id)) continue;
        seen.add(id);
        entries.push({
          eventName,
          operation: /dispatchEvent/.test(line) ? "dispatch" : /removeEventListener/.test(line) ? "unsubscribe" : "subscribe",
          owner: ownerFor(relative),
          path: relative,
          line: index + 1,
        });
      }
    });
  }
  return entries.sort((a, b) => a.eventName.localeCompare(b.eventName) || a.path.localeCompare(b.path));
}

function collectMockAndDefaultData(allFiles) {
  const entries = [];
  for (const file of allFiles.filter((candidate) => SOURCE_EXTENSIONS.has(path.extname(candidate)))) {
    const relative = relativePath(file);
    const source = readText(file);
    const pathSignal = /(^|\/)(mocks?|fixtures?|seeds?|demo-data|dev-memory)(\/|$)/i.test(relative);
    const symbols = [...source.matchAll(/\bexport\s+(?:const|let|var|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/g)]
      .map((match) => match[1])
      .filter((name) => /^(DEFAULT|MOCK|SEED|FIXTURE|DEMO|SAMPLE)_|^(default|mock|seed|fixture|demo|sample)/i.test(name));
    if (!pathSignal && symbols.length === 0) continue;
    entries.push({
      path: relative,
      owner: ownerFor(relative),
      runtimeCandidate: relative.startsWith("src/"),
      symbols: [...new Set(symbols)].sort(),
      signals: [pathSignal ? "path" : null, symbols.length ? "exported-symbol" : null].filter(Boolean),
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function compatibilitySignals(relative, source) {
  const signals = [];
  if (/legacy/i.test(relative)) signals.push("legacy-path");
  if (/compatib/i.test(relative)) signals.push("compatibility-path");
  if (/\/migrations?\//i.test(relative) && !relative.startsWith("backend/migrations/")) signals.push("migration-path");
  if (/\bdeprecated\b|@deprecated/i.test(source)) signals.push("deprecated-content");
  if (/\blegacy\b/i.test(source)) signals.push("legacy-content");
  if (/\bcompatibility\b|\bcompat\b/i.test(source)) signals.push("compatibility-content");
  if (/export\s*\{[^}]+\bas\b[^}]+\}/s.test(source)) signals.push("export-alias");
  return [...new Set(signals)];
}

function collectCompatibilityCandidates(allFiles) {
  const entries = [];
  for (const file of allFiles.filter((candidate) => SOURCE_EXTENSIONS.has(path.extname(candidate)))) {
    const relative = relativePath(file);
    const source = readText(file);
    const signals = compatibilitySignals(relative, source);
    if (signals.length === 0) continue;
    const aliases = [...source.matchAll(/\bexport\s*\{([\s\S]*?)\}/g)]
      .flatMap((match) => match[1].split(","))
      .map((item) => item.trim())
      .filter((item) => /\bas\b/.test(item))
      .slice(0, 20);
    entries.push({ path: relative, owner: ownerFor(relative), signals, aliases });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function collectDeprecatedComponents(allFiles) {
  const entries = [];
  for (const file of allFiles.filter((candidate) => [".tsx", ".jsx", ".ts"].includes(path.extname(candidate)))) {
    const relative = relativePath(file);
    const source = readText(file);
    const names = extractExportedNames(source).filter((name) => /Legacy|Deprecated/i.test(name));
    if (!/@deprecated/i.test(source) && names.length === 0 && !/Legacy[A-Za-z]*\.(tsx|ts)$/i.test(path.basename(file))) continue;
    entries.push({ path: relative, owner: ownerFor(relative), exportedNames: names, hasDeprecatedAnnotation: /@deprecated/i.test(source) });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function collectDuplicateGroups(allFiles) {
  const byHash = new Map();
  for (const file of allFiles) {
    const canonicalBytes = readCanonicalBytes(file);
    if (canonicalBytes.length < 200 || GENERATED_PATHS.has(relativePath(file))) continue;
    const hash = crypto.createHash("sha256").update(canonicalBytes).digest("hex");
    const bucket = byHash.get(hash) ?? [];
    bucket.push(relativePath(file));
    byHash.set(hash, bucket);
  }
  return [...byHash.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([sha256, files]) => ({ sha256, files: files.sort() }))
    .sort((a, b) => a.files[0].localeCompare(b.files[0]));
}

function classifyFiles(allFiles, graph, runtimeReachable, scriptReachable, testReachable, duplicateGroups) {
  const duplicateSecondary = new Set(duplicateGroups.flatMap((group) => group.files.slice(1)));
  const records = [];
  for (const file of allFiles) {
    const relative = relativePath(file);
    const extension = path.extname(file);
    const source = CODE_EXTENSIONS.has(extension) || extension === ".md" ? readText(file) : "";
    const compatibility = compatibilitySignals(relative, source);
    const deprecated = /@deprecated/i.test(source) || /Legacy[A-Za-z]*\.(tsx|ts)$/i.test(path.basename(file));
    const fixture = /(^|\/)(mocks?|fixtures?|seeds?|baselines?|demo-data|dev-memory)(\/|$)/i.test(relative) || /Fixture\.(ts|tsx)$/i.test(relative);
    const normalized = path.normalize(file);
    const usage = {
      runtimeReachable: runtimeReachable.has(normalized),
      scriptReachable: scriptReachable.has(normalized),
      testReachable: testReachable.has(normalized),
    };

    let classification;
    let reason;
    if (GENERATED_PATHS.has(relative)) {
      classification = "generated";
      reason = "Generated by repository inventory tooling.";
    } else if (extension === ".md" || (relative.startsWith("docs/") && extension === ".json")) {
      classification = "documentation";
      reason = extension === ".md" ? "Markdown documentation." : "Machine-readable documentation authority.";
    } else if (relative.startsWith("scripts/") || /^(package(?:-lock)?\.json|tsconfig.*\.json|vite\.config\.ts|playwright\.config\.ts|\.env\.example|\.gitignore|index\.html|metadata\.json)$/.test(relative)) {
      classification = "active-script";
      reason = "Repository tooling or build configuration.";
    } else if (relative.startsWith("tests/")) {
      classification = "active-test";
      reason = "Test source.";
    } else if (compatibility.length > 0) {
      classification = "compatibility";
      reason = compatibility.join(", ");
    } else if (deprecated) {
      classification = "deprecated";
      reason = "Deprecated annotation or legacy component name.";
    } else if (duplicateSecondary.has(relative)) {
      classification = "duplicate";
      reason = "Exact-content duplicate of an earlier repository file.";
    } else if (fixture) {
      classification = "fixture";
      reason = "Fixture, mock, seed, demo or baseline path.";
    } else if (usage.runtimeReachable || relative.startsWith("public/") || relative.startsWith("assets/")) {
      classification = "active-runtime";
      reason = usage.runtimeReachable ? "Reachable from src/main.tsx." : "Runtime static asset.";
    } else if (usage.testReachable || (relative.startsWith("src/") && usage.scriptReachable)) {
      classification = "active-test";
      reason = "Referenced by repository verification or tests but not by the runtime entry graph.";
    } else if (relative.startsWith("src/") && CODE_EXTENSIONS.has(extension)) {
      classification = "dead-candidate";
      reason = "Not reachable from runtime, test or script entry graphs; requires manual review before deletion.";
    } else {
      classification = "active-script";
      reason = "Repository support file.";
    }

    records.push({
      path: relative,
      classification,
      reason,
      owner: ownerFor(relative),
      bytes: readCanonicalBytes(file).length,
      lines: source ? lineCount(source) : null,
      usage,
    });
  }
  for (const generatedPath of [...GENERATED_PATHS].sort()) {
    records.push({
      path: generatedPath,
      classification: "generated",
      reason: "Generated by repository inventory tooling.",
      owner: ownerFor(generatedPath),
      bytes: null,
      lines: null,
      usage: { runtimeReachable: false, scriptReachable: false, testReachable: false },
    });
  }
  return records.sort((a, b) => a.path.localeCompare(b.path));
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function validateCriticalJourneys(qualityPipeline) {
  const gateIds = new Set((qualityPipeline.gates ?? []).map((gate) => gate.id));
  return CRITICAL_JOURNEYS.map((journey) => ({
    ...journey,
    evidenceStatus: journey.sourceEvidence.map((evidencePath) => ({
      path: evidencePath,
      exists: fs.existsSync(path.join(ROOT, evidencePath)),
    })),
    gateStatus: journey.verificationGateIds.map((gateId) => ({
      gateId,
      exists: gateIds.has(gateId),
    })),
  }));
}

function collectLoadableRouteModules(allFiles) {
  const knownFiles = new Set(allFiles.map((file) => path.normalize(file)));
  const routerFiles = allFiles.filter((file) => relativePath(file).startsWith("src/app/router/") && SOURCE_EXTENSIONS.has(path.extname(file)));
  const modules = new Set();
  for (const file of routerFiles) {
    for (const match of readText(file).matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
      const resolved = resolveImport(file, match[1], knownFiles);
      if (resolved) modules.add(relativePath(resolved));
    }
  }
  return [...modules].sort();
}

function buildInventoryFingerprint(inventoryWithoutFingerprint) {
  return crypto.createHash("sha256").update(JSON.stringify(inventoryWithoutFingerprint)).digest("hex");
}

export function buildRepositoryInventory() {
  const allFiles = listFiles().filter((file) => !GENERATED_PATHS.has(relativePath(file)));
  const graph = buildImportGraph(allFiles);
  const runtimeEntries = [path.join(ROOT, "src/main.tsx")];
  const scriptEntries = allFiles.filter((file) => relativePath(file).startsWith("scripts/") && CODE_EXTENSIONS.has(path.extname(file)));
  const testEntries = allFiles.filter((file) => relativePath(file).startsWith("tests/") && CODE_EXTENSIONS.has(path.extname(file)));
  const runtimeReachable = reachableFrom(runtimeEntries, graph);
  const scriptReachable = reachableFrom(scriptEntries, graph);
  const testReachable = reachableFrom(testEntries, graph);

  const collectPathReferences = (entries) => {
    const references = new Set();
    for (const entry of entries) {
      const source = readText(entry);
      for (const match of source.matchAll(/["'`](src\/[A-Za-z0-9_./-]+)["'`]/g)) {
        references.add(match[1].replace(/\/$/, ""));
      }
    }
    return references;
  };
  const scriptPathReferences = collectPathReferences(scriptEntries);
  const testPathReferences = collectPathReferences(testEntries);
  for (const file of allFiles) {
    const relative = relativePath(file);
    const normalized = path.normalize(file);
    if ([...scriptPathReferences].some((reference) => relative === reference || relative.startsWith(`${reference}/`))) scriptReachable.add(normalized);
    if ([...testPathReferences].some((reference) => relative === reference || relative.startsWith(`${reference}/`))) testReachable.add(normalized);
  }

  const packageJson = JSON.parse(readText(path.join(ROOT, "package.json")));
  const qualityPipelinePath = path.join(ROOT, "scripts/quality/quality-pipeline.json");
  const qualityPipeline = fs.existsSync(qualityPipelinePath)
    ? JSON.parse(readText(qualityPipelinePath))
    : { groups: [], gates: [] };

  const modules = parseModuleManifests();
  const routes = parseStringMap("src/platform/navigation/routeKeys.ts", "ROUTE_KEYS");
  const capabilities = parseStringMap("src/platform/access-control/domain/capabilityCatalog.ts", "CAPABILITIES");
  const workspaceFlags = parseWorkspaceFlags();
  const workflows = fs.readdirSync(path.join(ROOT, "src/workflows"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      key: entry.name,
      path: `src/workflows/${entry.name}`,
      publicBoundary: fs.existsSync(path.join(ROOT, "src/workflows", entry.name, "index.ts"))
        ? `src/workflows/${entry.name}/index.ts`
        : null,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const publicExports = collectPublicExports(allFiles);
  const persistenceEntries = collectPersistenceEntries(allFiles);
  const repositories = collectRepositories(allFiles);
  const browserEvents = collectBrowserEvents(allFiles);
  const mockAndDefaultData = collectMockAndDefaultData(allFiles);
  const compatibilityCandidates = collectCompatibilityCandidates(allFiles);
  const deprecatedComponents = collectDeprecatedComponents(allFiles);
  const duplicateGroups = collectDuplicateGroups(allFiles);
  const fileClassifications = classifyFiles(allFiles, graph, runtimeReachable, scriptReachable, testReachable, duplicateGroups);
  const circularDependencies = findCircularDependencies(new Map(
    [...graph.entries()].filter(([file]) => relativePath(file).startsWith("src/"))
      .map(([file, dependencies]) => [file, dependencies.filter((dependency) => relativePath(dependency).startsWith("src/"))]),
  ));
  const loadableRouteModules = collectLoadableRouteModules(allFiles);
  const sourceFiles = allFiles.filter((file) => relativePath(file).startsWith("src/") && SOURCE_EXTENSIONS.has(path.extname(file)));
  const largeFiles = sourceFiles
    .map((file) => ({ path: relativePath(file), owner: ownerFor(relativePath(file)), lines: lineCount(readText(file)), bytes: readCanonicalBytes(file).length }))
    .filter((entry) => entry.lines >= LARGE_FILE_THRESHOLD)
    .sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
  const criticalJourneys = validateCriticalJourneys(qualityPipeline);
  const qualityGroups = Array.isArray(qualityPipeline.groups) ? qualityPipeline.groups : [];
  const verifyGates = qualityGroups.flatMap((group) => Array.isArray(group.gates) ? group.gates : []);

  const inventory = {
    schemaVersion: 1,
    authority: {
      generator: "scripts/generate-repository-inventory.mjs",
      checker: "tests/quality/architecture/check-repository-inventory.mjs",
      runtimeEntry: "src/main.tsx",
      generatedFiles: [...GENERATED_PATHS].sort(),
      exclusions: [...EXCLUDED_DIRECTORIES].sort(),
    },
    summary: {
      repositoryFiles: allFiles.length + GENERATED_PATHS.size,
      sourceFiles: sourceFiles.length,
      sourceLines: sourceFiles.reduce((total, file) => total + lineCount(readText(file)), 0),
      modules: modules.length,
      routes: routes.length,
      loadableRouteModules: loadableRouteModules.length,
      capabilities: capabilities.length,
      workspaceFlags: workspaceFlags.length,
      workflows: workflows.length,
      publicBoundaryFiles: publicExports.length,
      publicExportStatements: publicExports.reduce((total, item) => total + item.statementCount, 0),
      persistenceEntries: persistenceEntries.length,
      repositoryImplementations: repositories.length,
      browserEventEntries: browserEvents.length,
      mockAndDefaultDataSources: mockAndDefaultData.length,
      compatibilityCandidates: compatibilityCandidates.length,
      deprecatedComponents: deprecatedComponents.length,
      duplicateGroups: duplicateGroups.length,
      largeFiles: largeFiles.length,
      circularDependencyGroups: circularDependencies.length,
      packageScripts: Object.keys(packageJson.scripts ?? {}).length,
      verifyGates: verifyGates.length,
      qualityGroups: qualityGroups.length,
      fileClassifications: countBy(fileClassifications, (item) => item.classification),
    },
    modules,
    routes,
    loadableRouteModules,
    capabilities,
    workspaceFlags,
    workflows,
    publicExports,
    persistence: {
      entries: persistenceEntries,
      countsByOwner: countBy(persistenceEntries, (item) => item.owner),
      countsByOperation: countBy(persistenceEntries, (item) => item.operation),
    },
    repositories,
    browserEvents,
    mockAndDefaultData,
    compatibilityCandidates,
    deprecatedComponents,
    duplicateGroups,
    largeFiles,
    circularDependencies,
    fileClassifications,
    criticalJourneys,
    qualityPipeline: qualityGroups.map((group) => ({
      id: group.id,
      label: group.label,
      gateCount: Array.isArray(group.gates) ? group.gates.length : 0,
      gates: Array.isArray(group.gates) ? group.gates : [],
    })),
    verificationContract: {
      requiredCommands: [
        "repo:check",
        "quality:gate",
        "build",
      ],
      criticalJourneyGateIds: [...new Set(CRITICAL_JOURNEYS.flatMap((journey) => journey.verificationGateIds))].sort(),
    },
  };
  return { ...inventory, inventoryFingerprint: buildInventoryFingerprint(inventory) };
}

function markdownList(items, limit = 60) {
  if (!items.length) return "- None detected.";
  const visible = items.slice(0, limit).map((item) => `- \`${item}\``);
  if (items.length > limit) visible.push(`- â€¦ ${items.length - limit} additional entries are available in the JSON manifest.`);
  return visible.join("\n");
}

export function renderRepositoryInventoryMarkdown(inventory) {
  const classificationRows = Object.entries(inventory.summary.fileClassifications)
    .map(([classification, count]) => `| \`${classification}\` | ${count} |`)
    .join("\n");
  const moduleRows = inventory.modules
    .map((module) => `| \`${module.key}\` | ${module.workspace} | ${module.routes.length} | \`${module.manifest}\` |`)
    .join("\n");
  const journeyRows = inventory.criticalJourneys
    .map((journey) => {
      const evidenceReady = journey.evidenceStatus.every((item) => item.exists);
      const gatesReady = journey.gateStatus.every((item) => item.exists);
      return `| \`${journey.id}\` | ${journey.name} | ${journey.owners.map((owner) => `\`${owner}\``).join(", ")} | ${evidenceReady && gatesReady ? "Ready" : "Incomplete"} | ${journey.verificationGateIds.map((gateId) => `\`npm run quality:gate -- --gate ${gateId}\``).join("<br>")} |`;
    })
    .join("\n");
  const persistenceRows = Object.entries(inventory.persistence.countsByOwner)
    .map(([owner, count]) => `| \`${owner}\` | ${count} |`)
    .join("\n");
  const largeFileRows = inventory.largeFiles.slice(0, 30)
    .map((item) => `| \`${item.path}\` | ${item.lines} | \`${item.owner}\` |`)
    .join("\n");
  const circularList = inventory.circularDependencies.map((group) => group.join(" â†’ "));
  const deadCandidates = inventory.fileClassifications.filter((item) => item.classification === "dead-candidate").map((item) => item.path);
  const compatibilityCandidates = inventory.compatibilityCandidates.map((item) => item.path);

  return `# Repository Inventory and Cleanup Baseline

## Purpose

This document is generated from the repository and records the structural baseline used to protect behavior while cleanup work proceeds. The JSON source of truth is \`docs/quality/repository-inventory.json\`.

Regenerate and verify it with:

\`\`\`bash
npm run repo:inventory
npm run repo:check
\`\`\`

Do not delete a dead, compatibility, deprecated or duplicate candidate based on this inventory alone. Confirm runtime, lazy-route, test, script, migration and documentation consumers first.

## Summary

| Metric | Count |
|---|---:|
| Repository files | ${inventory.summary.repositoryFiles} |
| Source files | ${inventory.summary.sourceFiles} |
| Source lines | ${inventory.summary.sourceLines} |
| Registered modules | ${inventory.summary.modules} |
| Route keys | ${inventory.summary.routes} |
| Loadable route modules | ${inventory.summary.loadableRouteModules} |
| Capabilities | ${inventory.summary.capabilities} |
| Workspace module flags | ${inventory.summary.workspaceFlags} |
| Cross-module workflows | ${inventory.summary.workflows} |
| Public boundary files | ${inventory.summary.publicBoundaryFiles} |
| Persistence entries | ${inventory.summary.persistenceEntries} |
| Repository/store/adapter files | ${inventory.summary.repositoryImplementations} |
| Compatibility candidates | ${inventory.summary.compatibilityCandidates} |
| Dead-code candidates | ${inventory.summary.fileClassifications["dead-candidate"] ?? 0} |
| Large source files (â‰¥ ${LARGE_FILE_THRESHOLD} lines) | ${inventory.summary.largeFiles} |
| Circular dependency groups | ${inventory.summary.circularDependencyGroups} |
| Package scripts | ${inventory.summary.packageScripts} |
| Quality groups | ${inventory.summary.qualityGroups} |
| Verify gates | ${inventory.summary.verifyGates} |

Inventory fingerprint: \`${inventory.inventoryFingerprint}\`


## Quality pipeline

| Group | Gates |
|---|---:|
${inventory.qualityPipeline.map((group) => `| ` + "`" + `${group.id}` + "`" + ` | ${group.gateCount} |`).join("\n")}

## File classification

| Classification | Count |
|---|---:|
${classificationRows}

A file has one primary classification and separate reachability flags in the JSON manifest. \`dead-candidate\` means only that no runtime, test or script path was found by the current static graph; it is not permission to delete the file.

## Registered modules

| Module | Workspace | Manifest routes | Manifest |
|---|---|---:|---|
${moduleRows}

## Cross-module workflows

${markdownList(inventory.workflows.map((workflow) => workflow.path))}

## Critical journeys

| Journey | Description | Owners | Evidence | Verification commands |
|---|---|---|---|---|
${journeyRows}

The journey table locks source evidence and executable command names. Actual command results remain runtime verification evidence and are not stored as permanent logs in the source package.

## Persistence ownership

| Owner | Entries |
|---|---:|
${persistenceRows}

The JSON manifest includes each detected key pattern, operation, path, line and browser-global signal. Dynamic key templates are recorded as patterns.

## Large source files

| File | Lines | Owner |
|---|---:|---|
${largeFileRows || "| None | 0 | â€” |"}

## Circular dependency groups

${markdownList(circularList, 40)}

## Compatibility candidates

${markdownList(compatibilityCandidates, 80)}

## Dead-code candidates

${markdownList(deadCandidates, 80)}

## Required verification

\`\`\`bash
npm run repo:check
npm run quality:gate -- --gate quality.route-module-loads
npm run build
\`\`\`

Critical journey gate IDs are enumerated in the JSON manifest and validated against the quality manifest authority by the inventory checker.
`;
}

export function serializeInventory(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}
