import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";

/**
 * RC-01 invariant.
 *
 * The Task aggregate identifier is server-assigned: `CreateTaskRequest` in
 * `docs/api/openapi.json` is `additionalProperties: false` and carries no `id`, and the
 * authoritative identifier only ever arrives back inside `TaskMutationResult.task.id`.
 * A deterministic, client-generated Task-intent value may therefore key idempotency and
 * dedupe, but must never be persisted as an authoritative Task foreign reference on the
 * Deal aggregate (`Deal.nextActionRef.id`, `CreateDealRequest.nextActionTaskId`,
 * `UpdateDealNextActionRequest.taskId`).
 *
 * The only place such a value is a legitimate aggregate identifier is a demo path whose
 * task creator actually persists the caller-supplied id. Both creator kinds are derived
 * from `src/modules/tasks/public/api.ts` and the workflow runtimes instead of being
 * listed by hand, and identity producers are recognised by the shape of the value they
 * return, so renaming a helper cannot silently reclassify it.
 */

const root = repositoryRoot;

const sourceFiles = walkFiles(path.join(root, "src"))
  .map((file: string) => file.split(path.sep).join("/"))
  .filter((file: string) => /\.tsx?$/u.test(file));

const read = new Map<string, string>(sourceFiles.map((file) => [file, fs.readFileSync(file, "utf8")]));
const relative = (file: string) => path.relative(root, file).split(path.sep).join("/");
const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

/** Text of a balanced `(`…`)` or `{`…`}` run starting at `open`. */
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

/** The expression assigned to a property, from just after its colon. */
function propertyValue(text: string): string {
  const value = /^[^,}\n]+/u.exec(text);
  return (value ? value[0] : "").trim();
}

/** Identifier tokens inside an expression. */
const tokensOf = (expression: string) => [...expression.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/gu)].map((token) => token[0]);

// ---------------------------------------------------------------------------
// 1. Task identity contract, read from OpenAPI rather than assumed.
// ---------------------------------------------------------------------------

const openApi = JSON.parse(fs.readFileSync(path.join(root, "docs/api/openapi.json"), "utf8")) as {
  components: { schemas: Record<string, { properties?: Record<string, unknown>; additionalProperties?: boolean }> };
};
const createTaskRequest = openApi.components.schemas.CreateTaskRequest;
assert.ok(createTaskRequest, "CreateTaskRequest must exist in the OpenAPI contract.");
assert.equal(
  Object.prototype.hasOwnProperty.call(createTaskRequest.properties ?? {}, "id"),
  false,
  "CreateTaskRequest must not accept a client-supplied Task id. If the contract changed, the RC-01 invariant must be re-derived, not this gate relaxed.",
);
assert.equal(createTaskRequest.additionalProperties, false, "CreateTaskRequest must stay closed.");

// ---------------------------------------------------------------------------
// 2. Task creators, split by whether they persist a caller-supplied identity.
// ---------------------------------------------------------------------------

const taskPublicApi = read.get(sourceFiles.find((file) => file.endsWith("/modules/tasks/public/api.ts"))!) ?? "";
assert.ok(taskPublicApi.length > 0, "The Tasks public API must be readable.");

/** Creators that persist the caller-supplied `id` (demo/local identity ownership). */
const identityForwardingCreators = new Set<string>();
/** Creators that discard the caller-supplied `id` because the runtime assigns it. */
const identityDiscardingCreators = new Set<string>();

for (const match of taskPublicApi.matchAll(/export\s+(?:const|async\s+function|function)\s+(create[A-Za-z0-9_$]*Task[A-Za-z0-9_$]*)\b/gu)) {
  const name = match[1];
  const bodyStart = taskPublicApi.indexOf("{", match.index! + match[0].length);
  if (bodyStart === -1) continue;
  const body = balanced(taskPublicApi, bodyStart, "{}");
  const forwardsId = /\.\.\.command\b/u.test(body) || /\bid\s*:\s*command\.id\b/u.test(body);
  if (forwardsId) identityForwardingCreators.add(name);
  else identityDiscardingCreators.add(name);
}

assert.ok(identityForwardingCreators.size > 0, "No identity-forwarding Task creator was derived. The scanner is broken, not the source.");
assert.ok(identityDiscardingCreators.size > 0, "No identity-discarding Task creator was derived. The scanner is broken, not the source.");

/**
 * Workflow port methods bound to an identity-forwarding creator, e.g.
 * `tasks: { create: (input) => createTaskSnapshot({ id: input.id, … }) }`.
 */
const forwardingPortCalls = new Set<string>();
for (const [file, text] of read) {
  if (!/\/runtime\//u.test(file)) continue;
  for (const match of text.matchAll(/\btasks\s*:\s*\{/gu)) {
    const block = balanced(text, match.index! + match[0].length - 1, "{}");
    if (!/\bcreate\s*:/u.test(block)) continue;
    if (!/\bid\s*:\s*input\.id\b/u.test(block)) continue;
    if (![...identityForwardingCreators].some((creator) => new RegExp(`\\b${creator}\\s*\\(`, "u").test(block))) continue;
    forwardingPortCalls.add("tasks.create");
  }
}

// ---------------------------------------------------------------------------
// 3. Client-generated Task identity producers, recognised by value shape.
// ---------------------------------------------------------------------------

/** A deterministic client-side Task identity literal, e.g. `` `task_deal_${dealId}_…` ``. */
const TASK_IDENTITY_LITERAL = /`task_[A-Za-z0-9_$]/u;

const identityProducers = new Set<string>();
for (const text of read.values()) {
  const declaration = /(?:export\s+)?(?:function\s+([A-Za-z0-9_$]+)\s*\(|const\s+([A-Za-z0-9_$]+)\s*(?::[^=\n]*)?=\s*(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>)/gu;
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(text)) !== null) {
    const name = match[1] ?? match[2];
    const window = text.slice(match.index, match.index + 400);
    if (/return\s*`task_/u.test(window) || /=>\s*`task_/u.test(window)) identityProducers.add(name);
  }
}

assert.ok(
  identityProducers.size > 0,
  "No client-generated Task identity producer was derived. The scanner is broken, not the source.",
);

// ---------------------------------------------------------------------------
// 4. Deal-side authoritative Task foreign-reference sinks.
// ---------------------------------------------------------------------------

interface Sink {
  file: string;
  line: number;
  sink: string;
  /** The source expression that lands in the Task foreign-reference field. */
  expression: string;
}

/** Local symbols in one file that hold a client-generated Task identity. */
function collectSyntheticSymbols(text: string): Set<string> {
  const symbols = new Set<string>();
  const binding = /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=\n]*)?=\s*([^;]+);/gu;
  let match: RegExpExecArray | null;
  while ((match = binding.exec(text)) !== null) {
    const [, name, value] = match;
    if (TASK_IDENTITY_LITERAL.test(value)) {
      symbols.add(name);
      continue;
    }
    if ([...identityProducers].some((producer) => new RegExp(`\\b${producer}\\s*\\(`, "u").test(value))) symbols.add(name);
  }
  return symbols;
}

/**
 * Is this expression a client-generated Task identity? Three shapes carry one: an inline
 * `task_…` template literal, a direct call to a producer, and a local symbol bound to
 * either of those.
 */
function isClientGeneratedIdentity(expression: string, synthetic: Set<string>): boolean {
  if (TASK_IDENTITY_LITERAL.test(expression)) return true;
  if ([...identityProducers].some((producer) => new RegExp(`\\b${producer}\\s*\\(`, "u").test(expression))) return true;
  return tokensOf(expression).some((token) => synthetic.has(token));
}

/** Does this file create the Task itself with this expression as the persisted aggregate id? */
function ownsIdentityLocally(text: string, expression: string): boolean {
  const tokens = tokensOf(expression);
  for (const creator of [...identityForwardingCreators, ...forwardingPortCalls]) {
    const call = new RegExp(`\\b${creator.replace(".", "\\.")}\\s*\\(`, "gu");
    let match: RegExpExecArray | null;
    while ((match = call.exec(text)) !== null) {
      const args = balanced(text, match.index + match[0].length - 1, "()");
      const id = /\bid\s*:\s*([^,}\n]+)/u.exec(args);
      if (!id) continue;
      const persisted = id[1].trim();
      if (persisted === expression) return true;
      if (tokens.length === 1 && new RegExp(`\\b${tokens[0]}\\b`, "u").test(persisted)) return true;
    }
  }
  return false;
}

const sinks: Sink[] = [];
const violations: Sink[] = [];

for (const [file, text] of read) {
  const synthetic = collectSyntheticSymbols(text);

  const record = (index: number, sink: string, expression: string) => {
    if (!expression) return;
    const entry = { file: relative(file), line: lineOf(text, index), sink, expression };
    sinks.push(entry);
    if (!isClientGeneratedIdentity(expression, synthetic)) return;
    if (ownsIdentityLocally(text, expression)) return;
    violations.push(entry);
  };

  // `nextActionRef: { type: "TASK", id: <expr> }`
  for (const match of text.matchAll(/nextActionRef\s*:/gu)) {
    const window = text.slice(match.index!, match.index! + 300);
    if (!/"TASK"/u.test(window)) continue;
    const id = /\bid\s*:\s*/u.exec(window);
    if (id) record(match.index!, "Deal.nextActionRef.id", propertyValue(window.slice(id.index + id[0].length)));
  }

  // `nextActionTaskId: <expr>` on a Deal create payload.
  for (const match of text.matchAll(/\bnextActionTaskId\s*:\s*/gu)) {
    record(match.index!, "CreateDealRequest.nextActionTaskId", propertyValue(text.slice(match.index! + match[0].length)));
  }

  // `taskId` passed to a Deal next-action mutation.
  for (const match of text.matchAll(/\b[A-Za-z0-9_$.]*[Nn]extAction[A-Za-z0-9_$]*\s*\(/gu)) {
    const args = balanced(text, match.index! + match[0].length - 1, "()");
    const explicit = /\btaskId\s*:\s*/u.exec(args);
    if (explicit) record(match.index!, "UpdateDealNextActionRequest.taskId", propertyValue(args.slice(explicit.index + explicit[0].length)));
    else if (/\btaskId\s*[,}]/u.test(args)) record(match.index!, "UpdateDealNextActionRequest.taskId", "taskId");
  }
}

assert.ok(sinks.length > 0, "No Deal Task foreign-reference sink was scanned. The scanner is broken, not the source.");

if (violations.length > 0) {
  const detail = violations
    .map((violation) => `  ${violation.file}:${violation.line}  ${violation.expression} -> ${violation.sink}`)
    .sort()
    .join("\n");
  assert.fail(
    "A client-generated Task identity must never be persisted as an authoritative Task foreign "
    + "reference. Task ids are server-assigned (CreateTaskRequest carries no `id`); keep the "
    + "deterministic value as an idempotency/dedupe key only, and take the Task reference from the "
    + "authoritative Task-create response or leave it unset.\n"
    + detail,
  );
}

console.log(
  `Server-assigned Task identity: PASS (${identityProducers.size} client-side Task identity producers, `
  + `${identityForwardingCreators.size} identity-forwarding and ${identityDiscardingCreators.size} identity-discarding `
  + `Task creators derived; ${sinks.length} Deal Task-reference sinks scanned, 0 client-generated).`,
);
