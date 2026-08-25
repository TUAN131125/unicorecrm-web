import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";

/**
 * MA-08 invariant (M10) — RC-08 safe user-facing failure presentation.
 *
 * Internal topology must not reach end users. Architecture refusals name workflow ids,
 * command classifications, adapter requirements and registry paths — useful for
 * diagnostics, meaningless and alarming as product copy.
 *
 * The rule is enforced where it is cheap and reliable: the error model must not turn an
 * internal diagnostic into user copy by default, the architecture codes must be declared
 * so the presentation layer can map them, and presentation must not render raw exception
 * text. Technical codes and messages are deliberately left intact on the error object.
 */

const root = repositoryRoot;

const sourceFiles = walkFiles(path.join(root, "src"))
  .map((file: string) => file.split(path.sep).join("/"))
  .filter((file: string) => /\.tsx?$/u.test(file));
const read = new Map<string, string>(sourceFiles.map((file) => [file, fs.readFileSync(file, "utf8")]));
const relative = (file: string) => path.relative(root, file).split(path.sep).join("/");
const sourceOf = (relativePath: string): string => {
  const absolute = [...read.keys()].find((file) => relative(file) === relativePath);
  assert.ok(absolute, `${relativePath} must be readable.`);
  return read.get(absolute)!;
};

// ---------------------------------------------------------------------------
// 1. The error model must not promote an internal diagnostic to user copy.
// ---------------------------------------------------------------------------

const mutationAuthority = sourceOf("src/shared/application/mutation/mutationAuthority.ts");
assert.doesNotMatch(
  mutationAuthority,
  /userMessage:\s*options\.userMessage\s*\?\?\s*options\.message/u,
  "MutationCommandError must not default `userMessage` to the internal `message`. Every architecture refusal is "
    + "built through it, so that default makes the central formatter render internal topology as product copy. "
    + "Leave `userMessage` unset and let presentation map the code.",
);
assert.match(
  mutationAuthority,
  /message: options\.message/u,
  "The internal diagnostic message must still be preserved on the error for logs and tests.",
);

// ---------------------------------------------------------------------------
// 2. Architecture refusal codes must be declared as unsafe for direct display.
//
// The inventory is derived from the throw sites, not hand-written, so a new architecture
// refusal fails this gate until it is classified.
// ---------------------------------------------------------------------------

const architectureCodePattern = /^(?:CONNECTED_|LOCAL_MUTATION_|IDEMPOTENCY_KEY_REUSED$)|_REQUIRES_(?:BACKEND|API|ASYNC)|_RESOURCE_VERSION_REQUIRED$|_BACKEND_REQUIRED$|_REQUIRES_BACKEND_CONTRACT$/u;

const thrownCodes = new Set<string>();
for (const file of sourceFiles) {
  const text = read.get(file)!;
  for (const match of text.matchAll(/new MutationCommandError\(\{[\s\S]{0,400}?code:\s*"([A-Z_]+)"/gu)) {
    thrownCodes.add(match[1]);
  }
  // `code: cond ? "A" : "B"` forms.
  for (const match of text.matchAll(/new MutationCommandError\(\{[\s\S]{0,400}?code:[^,]*?"([A-Z_]{4,})"\s*:\s*"([A-Z_]{4,})"/gu)) {
    thrownCodes.add(match[1]);
    thrownCodes.add(match[2]);
  }
}
assert.ok(thrownCodes.size > 10, `The thrown-code inventory must be derived from source (found ${thrownCodes.size}).`);

const architectureCodes = [...thrownCodes].filter((code) => architectureCodePattern.test(code)).sort();
assert.ok(
  architectureCodes.length > 5,
  `Architecture refusal codes must be detected (found ${architectureCodes.length}).`,
);

// The declaration lives with the presentation layer, not with the availability helper:
// `backendAvailability` imports the formatter, so declaring it there would make the
// formatter import back and close a cycle.
const presentationSource = sourceOf("src/shared/operations/errorPresentation.ts");
const declaredBlock = /(?:BACKEND_UNAVAILABLE_CODES|UNSAFE_FOR_DISPLAY_CODES)[\s\S]*?UNSAFE_FOR_DISPLAY_CODES[\s\S]*?\]\)/u.exec(presentationSource);
assert.ok(
  declaredBlock,
  "`src/shared/operations/errorPresentation.ts` must declare `UNSAFE_FOR_DISPLAY_CODES`: the set of architecture "
    + "refusal codes whose internal message may never be shown to a user.",
);
const undeclared = architectureCodes.filter((code) => !declaredBlock[0].includes(`"${code}"`));
assert.deepEqual(
  undeclared,
  [],
  "Every architecture refusal code must be declared unsafe for direct display, so presentation maps it to safe "
    + "unavailable copy instead of rendering its internal message.",
);

// ---------------------------------------------------------------------------
// 3. The central presentation must consult that declaration.
// ---------------------------------------------------------------------------

assert.match(
  presentationSource,
  /isUnsafeForDisplay|UNSAFE_FOR_DISPLAY/u,
  "`presentApplicationError` must refuse to render a `userMessage` that belongs to an architecture refusal code; "
    + "otherwise every caller of the sanctioned formatter still leaks internal topology.",
);

// ---------------------------------------------------------------------------
// 4. Presentation must not render raw exception text.
//
// Scanning is limited to user-message sinks so developer logging, error construction and
// tests are untouched.
// ---------------------------------------------------------------------------

const sinkPattern = /(?:showToast|triggerToast|setAlertMessage|notifyProduct|setMessage|setValidationError|setToastMessage|window\.alert)\s*\(/gu;
const rawErrorText = /\b(?:error|err|reason|cause)\s*(?:instanceof\s+Error\s*\?\s*[A-Za-z0-9_$.]*\.message|\.message\b)|String\s*\(\s*(?:error|err)\s*\)|`\$\{\s*(?:error|err)\s*\}`/u;

/** Text of the balanced call that starts at `open`. */
function balancedCall(text: string, open: number): string {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    else if (text[index] === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(open, index + 1);
    }
  }
  return text.slice(open, open + 400);
}

const leaks: string[] = [];
for (const file of sourceFiles) {
  if (!/\/(presentation|workspaces|components|pages)\//u.test(file)) continue;
  const text = read.get(file)!;
  for (const match of text.matchAll(sinkPattern)) {
    const call = balancedCall(text, match.index! + match[0].length - 1);
    if (!rawErrorText.test(call)) continue;
    const line = text.slice(0, match.index!).split("\n").length;
    leaks.push(`${relative(file)}:${line}`);
  }
}
assert.deepEqual(
  leaks,
  [],
  "A user-facing message must not be built from raw exception text. Route it through `formatApplicationError` or "
    + `\`formatOperationUnavailableError\`:\n${leaks.join("\n")}`,
);

// ---------------------------------------------------------------------------
// 5. `userMessage ?? message` in presentation is the same leak wearing a hat.
// ---------------------------------------------------------------------------

const userMessageFallback: string[] = [];
for (const file of sourceFiles) {
  if (!/\/(presentation|workspaces|components|pages)\//u.test(file)) continue;
  const text = read.get(file)!;
  for (const match of text.matchAll(/\.userMessage\s*\?\?\s*[A-Za-z0-9_$(). ]*\.message/gu)) {
    userMessageFallback.push(`${relative(file)}:${text.slice(0, match.index!).split("\n").length}`);
  }
}
assert.deepEqual(
  userMessageFallback,
  [],
  "Falling back from `userMessage` to `message` re-introduces the internal diagnostic as product copy. Use the "
    + `central formatter, which owns the safe fallback:\n${userMessageFallback.join("\n")}`,
);

// ---------------------------------------------------------------------------
// 6. Derived leak detection (M11, DF-25).
//
// Sections 4 and 5 scan a hand-written list of sink names. That list is a review
// boundary, not a proof: `setError`, `setOperationError` and any future setter are not on
// it, and four real presentation surfaces were rendering raw exception text through
// exactly those names. Naming more sinks would only move the boundary.
//
// So the rule is inverted here and made fail-closed. The subject is not the sink but the
// value: an identifier bound by a `catch` clause IS a raw exception, whatever it is
// called. Reading `.message` off it, stringifying it or interpolating it produces internal
// diagnostic text, and that text may only flow into a developer log, a rethrow, or one of
// the sanctioned formatters. Everything else is treated as user-facing and fails.
//
// Renaming the sink cannot evade this, and neither can renaming the exception.
// ---------------------------------------------------------------------------

/** Consumers that may legitimately receive raw exception text. */
const SANCTIONED_CONSUMER = /(?:console\s*\.\s*[A-Za-z]+|formatApplicationError|presentApplicationError|normalizeApplicationError|classifyMutationFailure|formatOperationUnavailableError|resolveAiInteractionState|reportError|captureException|recordOperationalAudit)\s*\($/u;

/** Text of a balanced `{`…`}` run starting at `open`. */
function balancedBlock(text: string, open: number): string {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open, index + 1);
    }
  }
  return text.slice(open);
}

/** Index of the `(` that matches the `)` at `close`. */
function matchingOpenParen(text: string, close: number): number {
  let depth = 0;
  for (let index = close; index >= 0; index -= 1) {
    if (text[index] === ")") depth += 1;
    else if (text[index] === "(") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Names that carry the raw exception inside one catch body.
 *
 * M12 §19 found that tracking only the catch binding itself is not enough: passing it into
 * an inline formatter — `((e) => String(e.message))(caught)` — moves every dangerous read
 * onto the arrow's parameter, and the scan saw nothing. So two bounded aliasing forms are
 * followed: a direct local rebinding, and the first parameter of an inline function the
 * binding is immediately applied to. Both are single-step and syntactic; this is not a
 * data-flow analysis and does not claim to be.
 */
function exceptionAliases(body: string, binding: string): Set<string> {
  const aliases = new Set<string>([binding]);
  for (const rebinding of body.matchAll(
    new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*(?::[^=;]+)?=\\s*${binding}\\s*[;,)]`, "gu"),
  )) {
    aliases.add(rebinding[1]);
  }
  // `( <function expression> )( binding )` — the binding becomes the function's parameter.
  for (const application of body.matchAll(new RegExp(`\\)\\s*\\(\\s*${binding}\\s*\\)`, "gu"))) {
    const open = matchingOpenParen(body, application.index!);
    if (open < 0) continue;
    const callee = body.slice(open, application.index! + 1);
    const parameter = /^\(\s*(?:async\s*)?(?:function\s*[A-Za-z0-9_$]*\s*)?\(\s*([A-Za-z_$][A-Za-z0-9_$]*)/u.exec(callee);
    if (parameter) aliases.add(parameter[1]);
  }
  return aliases;
}

const derivedLeaks: string[] = [];
let catchBindingsScanned = 0;
for (const file of sourceFiles) {
  if (!/\/(presentation|workspaces|components|pages)\//u.test(file)) continue;
  const text = read.get(file)!;
  for (const clause of text.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)\s*\{/gu)) {
    const binding = clause[1];
    const open = text.indexOf("{", clause.index! + clause[0].length - 1);
    if (open < 0) continue;
    catchBindingsScanned += 1;
    const body = balancedBlock(text, open);
    for (const alias of exceptionAliases(body, binding)) {
      // Precise by design. A sanctioned formatter is routinely called *inside* a template
      // literal, so a pattern that matched any interpolation mentioning the alias would
      // flag the correct code as a leak. Only a bare read of the exception counts:
      // `alias.message`, `(alias as Error).message`, `String(alias)`, or `${alias}`.
      const rawReads = new RegExp(
        `\\b${alias}\\s*\\.\\s*message\\b`
        + `|\\(\\s*${alias}\\s+as\\s+[^)]*\\)\\s*\\.\\s*message\\b`
        + `|\\bString\\s*\\(\\s*${alias}\\s*\\)`
        + `|\\$\\{\\s*${alias}\\s*\\}`,
        "gu",
      );
      for (const read of body.matchAll(rawReads)) {
        const preceding = body.slice(Math.max(0, read.index! - 160), read.index!);
        // Passed straight into a sanctioned consumer.
        if (SANCTIONED_CONSUMER.test(preceding.replace(/\s+$/u, ""))) continue;
        // Rethrown, or folded into a new error object for the layer above.
        if (/\bthrow\s+[^;]*$|new\s+[A-Za-z0-9_$]*Error\s*\(\s*\{?[^;]*$/u.test(preceding)) continue;
        const label = alias === binding ? `catch ${binding}` : `catch ${binding} via ${alias}`;
        derivedLeaks.push(`${relative(file)}:${text.slice(0, open + read.index!).split("\n").length}  (${label})`);
      }
    }
  }
}
assert.ok(
  catchBindingsScanned > 20,
  `The catch-binding scan must actually see presentation catch clauses (found ${catchBindingsScanned}).`,
);
assert.deepEqual(
  derivedLeaks,
  [],
  "A value bound by `catch` is a raw exception: its message names internal topology. It may only reach a developer "
    + "log, a rethrow, or a sanctioned formatter — never a user-facing value. Route it through "
    + `\`formatApplicationError\`:\n${derivedLeaks.join("\n")}`,
);

console.log(
  `quality.user-facing-error-safety: ${thrownCodes.size} thrown codes, ${architectureCodes.length} architecture `
    + `refusals declared unsafe for display, ${catchBindingsScanned} presentation catch bindings scanned, `
    + "zero raw exception text reaching a user-facing value.",
);
