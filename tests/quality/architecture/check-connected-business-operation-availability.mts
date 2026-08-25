import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";

/**
 * RC-04 invariant.
 *
 * A routed connected production UI action must not directly invoke a business port whose
 * connected binding cannot perform the authoritative backend mutation. The connected
 * composition declares those bindings itself, by calling `connectedOperationUnavailable`,
 * so the set of non-authoritative business operations is derived from the composition and
 * never from a hand-written file list. Renaming a handler or moving a page cannot escape
 * this gate; only changing the composition binding can.
 *
 * The chain from an unavailable binding to the presentation call site is resolved the same
 * way the runtime resolves it: composition member -> application-services accessor (direct
 * accessor or service proxy) -> module public export -> presentation caller. A presentation
 * caller is compliant when the enclosing handler refuses first, by consulting an
 * availability predicate for the same operation before the port is touched.
 *
 * Workflow ports (`connectedWorkflowServices.ts`) are deliberately out of scope: canonical
 * workflow command containment is owned by the command-dispatch gate.
 */

const root = repositoryRoot;

const sourceFiles = walkFiles(path.join(root, "src"))
  .map((file: string) => file.split(path.sep).join("/"))
  .filter((file: string) => /\.tsx?$/u.test(file));

const read = new Map<string, string>(sourceFiles.map((file) => [file, fs.readFileSync(file, "utf8")]));
const relative = (file: string) => path.relative(root, file).split(path.sep).join("/");
const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

/** Text of a balanced run starting at `open`. */
function balanced(text: string, open: number, pair: "()" | "{}"): string {
  const [start, end] = pair.split("") as [string, string];
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === start) depth += 1;
    else if (text[index] === end) {
      depth -= 1;
      if (depth === 0) return text.slice(open, index + 1);
    }
  }
  return text.slice(open);
}

// ---------------------------------------------------------------------------
// 1. Non-authoritative connected bindings, read from the connected composition.
// ---------------------------------------------------------------------------

interface UnavailableBinding {
  /** Port group the member belongs to, e.g. `configuration`, `receivableOperations`. */
  group: string;
  /** Port member, e.g. `saveSellerInformation`. */
  member: string;
  /** Operation label the composition declares. Used as the availability key. */
  label: string;
  file: string;
}

const compositionFiles = sourceFiles.filter((file) => (
  /\/app\/composition\/connected\/connected[A-Za-z]*ModuleServices\.ts$/u.test(file)
));
assert.ok(compositionFiles.length > 0, "The connected module composition must be readable.");

/** The port group a position sits inside, from the nearest enclosing `name: {` heading. */
function enclosingGroup(text: string, position: number): string {
  const headings = [...text.slice(0, position).matchAll(/([A-Za-z0-9_$]+)\s*:\s*\{/gu)];
  for (const heading of [...headings].reverse()) {
    const block = balanced(text, text.indexOf("{", heading.index!), "{}");
    if (heading.index! + block.length >= position) return heading[1];
  }
  return "";
}

const unavailableBindings: UnavailableBinding[] = [];
for (const file of compositionFiles) {
  const text = read.get(file) ?? "";
  const pattern = /([A-Za-z0-9_$]+)\s*:\s*(?:(?:\([^)]*\)|[A-Za-z0-9_$]*)\s*=>\s*connectedOperationUnavailable|unavailableConnectedOperation)\s*\(\s*"([^"]+)"/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    unavailableBindings.push({
      group: enclosingGroup(text, match.index),
      member: match[1],
      label: match[2],
      file: relative(file),
    });
  }
}

assert.ok(
  unavailableBindings.length > 0,
  "No non-authoritative connected business binding was derived. The scanner is broken, not the source.",
);

// ---------------------------------------------------------------------------
// 2. Application-services accessors that reach those members.
// ---------------------------------------------------------------------------

/** Exported symbol -> label, for symbols that reach a non-authoritative binding. */
const nonAuthoritativeSymbols = new Map<string, string>();

/**
 * Resolves a port member to its declared binding. A binding written inside a factory
 * function (`createInvoiceConfiguration()`) has no named group heading, so the member name
 * alone identifies it; member names are unique across the connected composition, which is
 * asserted below.
 */
function findBinding(group: string, member: string): UnavailableBinding | undefined {
  return unavailableBindings.find((item) => item.member === member && (item.group === group || item.group === ""));
}

// Only a binding written inside a factory function is resolved by member name alone, so
// only those members have to be unambiguous.
const factoryMembers = unavailableBindings.filter((binding) => binding.group === "").map((binding) => binding.member);
const ambiguousFactoryMembers = factoryMembers.filter((member, index, all) => (
  all.indexOf(member) !== index
  || unavailableBindings.some((binding) => binding.group !== "" && binding.member === member)
));
assert.deepEqual(
  [...new Set(ambiguousFactoryMembers)],
  [],
  "A connected binding declared inside a factory function must have an unambiguous member name.",
);

for (const [file, text] of read) {
  if (!/\/modules\/[^/]+\/application\/composition\//u.test(file)) continue;

  // `export const proxy = createApplicationServiceProxy(() => binding.get().<group>);`
  const proxies = new Map<string, string>();
  for (const match of text.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)\s*=\s*createApplicationServiceProxy\s*\(\s*\(\)\s*=>\s*binding\.get\(\)\.([A-Za-z0-9_$]+)\s*\)/gu)) {
    proxies.set(match[1], match[2]);
  }

  // `export const accessor = (...) => binding.get().<group>.<member>(...)`
  for (const match of text.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)[^=\n]*=\s*[^;]*?binding\.get\(\)\.([A-Za-z0-9_$]+)\.([A-Za-z0-9_$]+)/gu)) {
    const binding = findBinding(match[2], match[3]);
    if (binding) nonAuthoritativeSymbols.set(match[1], binding.label);
  }

  // A public module file consuming the proxy: `proxy.<member>(...)`.
  for (const [proxyName, group] of proxies) {
    for (const [publicFile, publicText] of read) {
      if (!/\/modules\/[^/]+\/public\//u.test(publicFile)) continue;
      if (!publicText.includes(proxyName)) continue;
      const call = new RegExp(`export\\s+(?:const|function)\\s+([A-Za-z0-9_$]+)[^;]*?\\b${proxyName}\\.([A-Za-z0-9_$]+)\\s*\\(`, "gu");
      let match: RegExpExecArray | null;
      while ((match = call.exec(publicText)) !== null) {
        const binding = findBinding(group, match![2]);
        if (binding) nonAuthoritativeSymbols.set(match[1], binding.label);
      }
    }
  }
}

// Public re-exports of an application accessor keep the same authority.
for (const [file, text] of read) {
  if (!/\/modules\/[^/]+\/public\//u.test(file)) continue;
  for (const match of text.matchAll(/export\s*\{([^}]*)\}\s*from/gu)) {
    for (const entry of match[1].split(",")) {
      const [original, alias] = entry.split(" as ").map((part) => part.trim());
      const label = nonAuthoritativeSymbols.get(original);
      if (label && alias) nonAuthoritativeSymbols.set(alias, label);
    }
  }
  // `export const publicName = accessorName;` re-exports the same authority.
  for (const match of text.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)\s*=\s*([A-Za-z0-9_$]+)\s*;/gu)) {
    const label = nonAuthoritativeSymbols.get(match[2]);
    if (label) nonAuthoritativeSymbols.set(match[1], label);
  }
  // `export const publicName = accessorName;` and thin wrappers around it.
  for (const match of text.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_$]+)[^;{]*[={][^;]{0,400}/gu)) {
    for (const [symbol, label] of [...nonAuthoritativeSymbols]) {
      if (symbol === match[1]) continue;
      if (new RegExp(`\\b${symbol}\\s*\\(`, "u").test(match[0])) nonAuthoritativeSymbols.set(match[1], label);
    }
  }
}

assert.ok(
  nonAuthoritativeSymbols.size > 0,
  "No module boundary was resolved to a non-authoritative connected binding. The scanner is broken, not the source.",
);

/**
 * Presentation reaches a module boundary either directly or through a hook that re-exports
 * it under a local name (`resetStageConfigs: resetDealStages`). Aliases are resolved per
 * file and only for symbols that file actually imports, so a generic local name such as
 * `onSave` in an unrelated component can never inherit an operation label.
 */
function importedNonAuthoritative(text: string): Map<string, string> {
  const imported = new Map<string, string>();
  for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from/gu)) {
    for (const entry of match[1].split(",")) {
      const parts = entry.split(" as ").map((part) => part.trim());
      const original = parts[0];
      const local = parts[1] ?? parts[0];
      const label = nonAuthoritativeSymbols.get(original);
      if (label && local) imported.set(local, label);
    }
  }
  return imported;
}

/** Local aliases of an imported non-authoritative symbol, e.g. `resetStageConfigs: resetDealStages`. */
function localAliases(text: string, imported: Map<string, string>): Map<string, string> {
  const aliases = new Map(imported);
  for (const [symbol, label] of imported) {
    const pattern = new RegExp(`\\b([A-Za-z0-9_$]+)\\s*[:=]\\s*${symbol}\\s*[,;\\n}]`, "gu");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] !== symbol) aliases.set(match[1], label);
    }
  }
  return aliases;
}

/**
 * Hook name -> returned key -> label, for hooks that hand a module boundary to their callers.
 * A consumer destructuring that key is calling the boundary just as directly.
 */
const hookExports = new Map<string, Map<string, string>>();
for (const [file, text] of read) {
  const imported = importedNonAuthoritative(text);
  if (imported.size === 0) continue;
  for (const match of text.matchAll(/export\s+function\s+(use[A-Z][A-Za-z0-9_$]*)\s*\(/gu)) {
    const body = balanced(text, text.indexOf("{", match.index! + match[0].length), "{}");
    const returned = new Map<string, string>();
    for (const [alias, label] of localAliases(body, imported)) returned.set(alias, label);
    if (returned.size > 0) hookExports.set(match[1], returned);
  }
}

// ---------------------------------------------------------------------------
// 3. Presentation callers must refuse before touching the port.
// ---------------------------------------------------------------------------

/** True when this handler consults an availability predicate for `label` first. */
function hasAvailabilityPreflight(text: string, handler: string, label: string): boolean {
  const direct = new RegExp(`isBusinessOperationUnavailable\\s*\\(\\s*"${label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}"`, "u");
  if (direct.test(handler)) return true;
  // A named predicate declared in this file or imported from a module public API, whose own
  // body asks about the same operation.
  for (const match of handler.matchAll(/\b(is[A-Za-z0-9_$]*Unavailable|refuse[A-Za-z0-9_$]*)\s*\(/gu)) {
    const name = match[1];
    for (const [, candidateText] of read) {
      const declaration = new RegExp(`(?:const|function)\\s+${name}\\b[^;]{0,600}`, "u").exec(candidateText);
      if (declaration && direct.test(declaration[0])) return true;
    }
    const localDeclaration = new RegExp(`(?:const|function)\\s+${name}\\b[^;]{0,600}`, "u").exec(text);
    if (localDeclaration && direct.test(localDeclaration[0])) return true;
  }
  return false;
}

/** Enclosing function body for a position, found by walking braces outward. */
function enclosingHandler(text: string, position: number): { name: string; body: string } {
  const stack: number[] = [];
  for (let index = 0; index < position; index += 1) {
    if (text[index] === "{") stack.push(index);
    else if (text[index] === "}") stack.pop();
  }
  for (const open of [...stack].reverse()) {
    const before = text.slice(Math.max(0, open - 220), open);
    if (/\b(?:if|for|while|switch|catch|try|else|do)\s*(?:\([^()]*\))?\s*$/u.test(before)) continue;
    if (!/(?:=>|\)\s*(?::\s*[A-Za-z0-9_<>[\]|,.\s]+)?)\s*$/u.test(before)) continue;
    const named = [...before.matchAll(/(?:const|function)\s+([A-Za-z0-9_$]+)/gu)].pop();
    return { name: named ? named[1] : "<anonymous>", body: balanced(text, open, "{}") };
  }
  return { name: "<module>", body: text };
}

interface Violation {
  file: string;
  line: number;
  handler: string;
  symbol: string;
  label: string;
}

const violations: Violation[] = [];
let callSites = 0;

for (const [file, text] of read) {
  if (!/\/presentation\/|\/workspaces\//u.test(file)) continue;

  const candidates = localAliases(text, importedNonAuthoritative(text));

  // Names destructured from a hook that hands out a module boundary.
  for (const [hook, returned] of hookExports) {
    if (!new RegExp(`\\b${hook}\\s*\\(`, "u").test(text)) continue;
    const destructured = new RegExp(`\\{([^}]*)\\}\\s*=\\s*${hook}\\s*\\(`, "gu");
    let match: RegExpExecArray | null;
    while ((match = destructured.exec(text)) !== null) {
      for (const entry of match[1].split(",")) {
        const parts = entry.split(":").map((part) => part.trim());
        const key = parts[0];
        const local = parts[1] ?? parts[0];
        const label = returned.get(key);
        if (label && local) candidates.set(local, label);
      }
    }
  }

  for (const [symbol, label] of candidates) {
    const call = new RegExp(`\\b${symbol}\\s*\\(`, "gu");
    let match: RegExpExecArray | null;
    while ((match = call.exec(text)) !== null) {
      const lineStart = text.lastIndexOf("\n", match.index) + 1;
      if (/^\s*(?:import|export)\b/u.test(text.slice(lineStart, match.index))) continue;
      callSites += 1;
      const handler = enclosingHandler(text, match.index);
      if (hasAvailabilityPreflight(text, handler.body, label)) continue;
      violations.push({
        file: relative(file),
        line: lineOf(text, match.index),
        handler: handler.name,
        symbol,
        label,
      });
    }
  }
}

if (violations.length > 0) {
  const detail = violations
    .map((violation) => `  ${violation.file}:${violation.line}  ${violation.handler}() -> ${violation.symbol}()  [${violation.label}]`)
    .sort()
    .join("\n");
  assert.fail(
    "A connected presentation action must not invoke a business port the connected composition "
    + "cannot execute authoritatively. Refuse first with an availability predicate for the same "
    + "operation, keep the local path on the demo binding, and never report success for a write "
    + "the backend never received. Unguarded call sites:\n"
    + detail,
  );
}

console.log(
  `Connected business operation availability: PASS (${unavailableBindings.length} non-authoritative connected `
  + `bindings derived from the composition; ${nonAuthoritativeSymbols.size} module boundaries resolved; `
  + `${callSites} presentation call sites, all preflighted).`,
);
