import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";

/**
 * RC-05 invariant.
 *
 * Once an authoritative backend mutation has committed, presentation code must not
 * mutate an authoritative module repository or connected projection locally to
 * simulate the committed result. Connected state after a command comes from the
 * authoritative response, an authoritative resource refresh, module invalidation or
 * a backend-owned projection — never from a presentation-originated local write.
 *
 * The set of authoritative writers is derived from the module public APIs by tracing
 * each exported collection writer to a repository/projection write, so the gate does
 * not depend on a hand-written list of setter names. Local aliases and one level of
 * local helper indirection are resolved too, because the original defect in
 * `useQuoteBuilderController` reached the Deal repository through a helper.
 */

const root = repositoryRoot;

const sourceFiles = walkFiles(path.join(root, "src"))
  .map((file: string) => file.split(path.sep).join("/"))
  .filter((file: string) => /\.tsx?$/u.test(file));

const read = new Map<string, string>(sourceFiles.map((file) => [file, fs.readFileSync(file, "utf8")]));
const relative = (file: string) => path.relative(root, file).split(path.sep).join("/");

/** A write that lands on an authoritative module repository or connected projection. */
const REPOSITORY_WRITE = /\b\w*[Rr]epository\.(?:replace|update|upsert)\s*\(|\bupdate\w*Collection\s*\(/u;

/**
 * Exported module collection writers that reach an authoritative store. Derived from
 * `src/modules/<m>/public/**` rather than enumerated by hand.
 */
function collectAuthoritativeWriters(): Set<string> {
  const writers = new Set<string>();
  for (const [file, text] of read) {
    if (!/\/modules\/[^/]+\/public\//u.test(file)) continue;
    // Positions first, then slice: a consuming window would swallow the declarations
    // that follow it and silently shrink the derived writer set.
    const declaration = /export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_]+)/gu;
    let match: RegExpExecArray | null;
    while ((match = declaration.exec(text)) !== null) {
      const name = match[1];
      if (!/^(?:set|update|replace)[A-Z]/u.test(name)) continue;
      const body = text.slice(match.index, match.index + 500);
      if (REPOSITORY_WRITE.test(body)) writers.add(name);
    }
  }
  return writers;
}

const authoritativeWriters = collectAuthoritativeWriters();
assert.ok(
  authoritativeWriters.size > 0,
  "No authoritative module collection writer was derived. The scanner is broken, not the source.",
);

/** An awaited authoritative mutation boundary. */
const AWAITED_COMMAND = /\bawait\s+[A-Za-z0-9_.]*(?:Command|CommandBoundary|Canonical|ViaApi)\s*\(/u;

/**
 * A sequence of authoritative mutations run through the M9 partial-commit reporter.
 *
 * M11 (DF-11): looking only for `await someCommand(...)` silently lost coverage when M9
 * moved multi-command handlers onto `executeSequentialCommits`. The commands now live in
 * `run: () => updateDealCommand(...)` closures and the only `await` in the handler is on
 * the reporter, so the three highest-risk handlers in the repository — the ones that
 * commit several authoritative mutations in a row — stopped being scanned for MA-04 at
 * all. A negative control that reintroduced a post-commit `replaceDeals(...)` into the
 * Deal edit success path passed the gate.
 */
const SEQUENCED_COMMANDS = /\b(?:executeSequentialCommits|summarizeBulkCommits)\s*\(/u;
const COMMAND_CALL = /\b[A-Za-z0-9_.]*(?:Command|CommandBoundary|Canonical|ViaApi)\s*\(/u;

/** True when this body commits at least one authoritative mutation. */
function commitsAuthoritatively(body: string): boolean {
  if (AWAITED_COMMAND.test(body)) return true;
  return SEQUENCED_COMMANDS.test(body) && COMMAND_CALL.test(body);
}

/**
 * A connected-mode decision. A local write is acceptable only where the same code path
 * has established that the module is running its demo repository.
 *
 * M11 (DF-11): `*Unavailable` used to count as a connected-mode decision here, which was
 * wrong on this rule's own terms. An availability predicate is a REFUSAL — the code after
 * it runs in connected mode — not evidence that the module is on its demo repository. The
 * effect was that M6/M7/M8 preflights exempted their entire handler from MA-04: a
 * post-commit `replaceDeals(...)` reintroduced into the Deal edit success path passed the
 * gate purely because the handler also contained `isWorkActivationUnavailable()`.
 */
/**
 * A guard that establishes, at a specific position, that what follows is not running
 * against backend authority: an availability predicate, a connected-mode check, or the
 * module data-authority probe.
 *
 * Two properties matter, and M11 found the gate had neither.
 *
 * POSITION — the guard used to be matched anywhere in the body, so a preflight for an
 * unrelated concern exempted every later write. A post-commit `replaceDeals(...)`
 * reintroduced into the Deal edit success path passed the gate purely because the handler
 * also contained `isWorkActivationUnavailable()` a hundred lines earlier.
 *
 * PURITY — the guard's test must be the predicate and nothing else. M8's WF-21 preflight
 * reads `if (nextActionAt && isWorkActivationUnavailable()) return;`, which refuses only
 * when the user asked for follow-up work; the handler still runs in connected mode
 * otherwise, so it exempts nothing. `if (contactWritesUnavailable) return;` and
 * `if (!contactWritesUnavailable) setContacts(...)` are pure, and they do: the first makes
 * everything after it demo-only, the second guards its own write.
 */
const PURE_MODE_GUARD = /\bif\s*\(\s*!?\s*[A-Za-z0-9_.]*(?:[Uu]navailable[A-Za-z0-9_]*|isModuleDataAuthorityRegistryConfigured|is[A-Za-z0-9_]*Connected[A-Za-z0-9_]*)\s*(?:\(\s*\))?\s*\)/gu;

/** Offsets in `body` at which a pure mode guard takes effect. */
function pureGuardOffsets(body: string): number[] {
  const offsets: number[] = [];
  PURE_MODE_GUARD.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PURE_MODE_GUARD.exec(body)) !== null) offsets.push(match.index);
  return offsets;
}

interface FunctionBody {
  name: string;
  start: number;
  text: string;
}

/** True when the `{` at `open` starts a function body rather than an if/try/loop block. */
function opensFunctionBody(text: string, open: number): boolean {
  const before = text.slice(Math.max(0, open - 200), open);
  if (/\b(?:if|for|while|switch|catch|try|else|do)\s*(?:\([^()]*\))?\s*$/u.test(before)) return false;
  return /(?:=>|\)\s*(?::\s*[A-Za-z0-9_<>\[\]|,.\s]+)?)\s*$/u.test(before);
}

/** Names the function whose body opens at `open`, for reporting only. */
function nameFunctionBody(text: string, open: number): string {
  const before = text.slice(Math.max(0, open - 400), open);
  const named = [...before.matchAll(/(?:function\s+|const\s+|async\s+function\s+)([A-Za-z0-9_$]+)/gu)].pop();
  return named ? named[1] : "<anonymous>";
}

/**
 * Every enclosing function body, found by walking outward from a position rather than
 * by matching declaration headings. Declaration forms in this repository include
 * multi-line destructured parameters with inline object types, which no heading regex
 * survives; brace walking is form-independent.
 */
function enclosingFunctionBodies(text: string, position: number): FunctionBody[] {
  const bodies: FunctionBody[] = [];
  const stack: number[] = [];
  for (let index = 0; index < position; index += 1) {
    if (text[index] === "{") stack.push(index);
    else if (text[index] === "}") stack.pop();
  }
  for (const open of [...stack].reverse()) {
    if (!opensFunctionBody(text, open)) continue;
    let depth = 0;
    let index = open;
    while (index < text.length) {
      if (text[index] === "{") depth += 1;
      else if (text[index] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    bodies.push({ name: nameFunctionBody(text, open), start: open, text: text.slice(open, index + 1) });
  }
  return bodies;
}

/**
 * Every named function body in a file, used for alias resolution. Helpers such as
 * `appendDealActivity` contain no `await`, so they are invisible to the awaited-command
 * walk above yet still reach an authoritative writer on behalf of their caller.
 */
function readAllNamedBodies(text: string): FunctionBody[] {
  const bodies: FunctionBody[] = [];
  const heading = /(?:const|function)\s+([A-Za-z0-9_$]+)\s*(?:[:=][^=\n]*)?(?:=>|\([^)]*\))?[^{;]*\{/gu;
  let match: RegExpExecArray | null;
  while ((match = heading.exec(text)) !== null) {
    const open = text.indexOf("{", match.index + match[0].length - 1);
    if (open === -1) continue;
    let depth = 0;
    let index = open;
    while (index < text.length) {
      if (text[index] === "{") depth += 1;
      else if (text[index] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    bodies.push({ name: match[1], start: match.index, text: text.slice(open, index + 1) });
  }
  return bodies;
}

/** All function bodies that commit at least one authoritative mutation. */
function readFunctionBodies(text: string): FunctionBody[] {
  const found = new Map<number, FunctionBody>();
  // Both entry shapes: a directly awaited command, and a command handed to the
  // partial-commit reporter as a step closure.
  const entryPoints = /\bawait\s+[A-Za-z0-9_.]*(?:Command|CommandBoundary|Canonical|ViaApi)\s*\(|\b(?:executeSequentialCommits|summarizeBulkCommits)\s*\(/gu;
  let match: RegExpExecArray | null;
  while ((match = entryPoints.exec(text)) !== null) {
    for (const body of enclosingFunctionBodies(text, match.index)) {
      if (!found.has(body.start)) found.set(body.start, body);
    }
  }
  return [...found.values()].sort((left, right) => left.start - right.start);
}

/** Local names in a file that reach an authoritative writer (alias or one-level helper). */
function collectLocalWriterAliases(text: string, bodies: FunctionBody[]): Set<string> {
  const aliases = new Set<string>();

  // `const setDeals = (updater) => updateDeals(updater);`
  const inlineAlias = /const\s+([A-Za-z0-9_$]+)\s*(?::[^=]*)?=\s*(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>\s*\{?\s*([A-Za-z0-9_$]+)\s*\(/gu;
  let match: RegExpExecArray | null;
  while ((match = inlineAlias.exec(text)) !== null) {
    if (authoritativeWriters.has(match[2])) aliases.add(match[1]);
  }

  // `const { deals, setDeals } = useDeals();` where the hook returns an authoritative writer.
  const destructured = /const\s*\{([^}]*)\}\s*=\s*(use[A-Z][A-Za-z0-9_$]*)\s*\(/gu;
  while ((match = destructured.exec(text)) !== null) {
    const names = match[1].split(",").map((item) => item.split(":").pop()!.trim()).filter(Boolean);
    const hookFile = sourceFiles.find((file) => file.endsWith(`/${match![2]}.ts`) || file.endsWith(`/${match![2]}.tsx`));
    if (!hookFile) continue;
    const hookText = read.get(hookFile) ?? "";
    for (const name of names) {
      const returnsWriter = new RegExp(`const\\s+${name}\\s*(?::[^=]*)?=\\s*(?:\\([^)]*\\)|[A-Za-z0-9_$]+)\\s*=>\\s*\\{?\\s*([A-Za-z0-9_$]+)\\s*\\(`, "u").exec(hookText);
      if (returnsWriter && authoritativeWriters.has(returnsWriter[1])) aliases.add(name);
    }
  }

  // One level of local helper indirection: a helper whose body calls an authoritative writer.
  for (const body of bodies) {
    for (const writer of [...authoritativeWriters, ...aliases]) {
      if (new RegExp(`\\b${writer}\\s*\\(`, "u").test(body.text)) {
        aliases.add(body.name);
        break;
      }
    }
  }

  return aliases;
}

interface Violation {
  file: string;
  fn: string;
  writer: string;
  line: number;
}

/**
 * RC-05 is about the success path. A write inside `catch` is failure compensation —
 * the demo snapshot rollback in the return workflows — not a post-commit write, so
 * catch bodies are blanked before scanning.
 */
function withoutCatchBlocks(body: string): string {
  let result = body;
  for (;;) {
    const start = result.search(/\bcatch\s*(?:\([^)]*\))?\s*\{/u);
    if (start === -1) return result;
    const open = result.indexOf("{", start);
    let depth = 0;
    let index = open;
    while (index < result.length) {
      if (result[index] === "{") depth += 1;
      else if (result[index] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    result = `${result.slice(0, start)}${" ".repeat(index - start + 1)}${result.slice(index + 1)}`;
  }
}

const violations: Violation[] = [];

for (const [file, text] of read) {
  if (!/\/(?:presentation|workflows|workspaces)\//u.test(file)) continue;
  const namedBodies = readAllNamedBodies(text);
  const bodies = readFunctionBodies(text);
  const localWriters = collectLocalWriterAliases(text, namedBodies);
  const everyWriter = new Set([...authoritativeWriters, ...localWriters]);

  // A local helper may carry the connected-mode decision itself, so the caller's body
  // is not the only place the guard may legitimately live.
  const guardedHelpers = new Set(
    namedBodies
      .filter((body) => localWriters.has(body.name) && pureGuardOffsets(body.text).length > 0)
      .map((body) => body.name),
  );

  for (const body of bodies) {
    // Report the innermost enclosing function only, so an outer hook body does not
    // duplicate every violation its own handlers already report.
    const enclosesAnotherCommandBody = bodies.some((other) => (
      other !== body
      && other.start > body.start
      && other.start < body.start + body.text.length
      && commitsAuthoritatively(withoutCatchBlocks(other.text))
    ));
    if (enclosesAnotherCommandBody) continue;

    const successPath = withoutCatchBlocks(body.text);
    if (!commitsAuthoritatively(successPath)) continue;
    const guards = pureGuardOffsets(successPath);
    for (const writer of everyWriter) {
      // A function is allowed to be the writer alias itself.
      if (writer === body.name) continue;
      if (guardedHelpers.has(writer)) continue;
      const call = new RegExp(`\\b${writer}\\s*\\(`, "u").exec(successPath);
      if (!call) continue;
      // A pure mode guard earlier in the same body makes this write demo-only.
      if (guards.some((offset) => offset < call.index)) continue;
      // Skip the awaited command itself (some commands are named update*/save*).
      const precedingAwait = successPath.slice(Math.max(0, call.index - 7), call.index);
      if (/await\s*$/u.test(precedingAwait)) continue;
      violations.push({
        file: relative(file),
        fn: body.name,
        writer,
        line: text.slice(0, body.start + call.index).split("\n").length,
      });
    }
  }
}

if (violations.length > 0) {
  const detail = violations
    .map((violation) => `  ${violation.file}  ${violation.fn}() -> ${violation.writer}()  (~line ${violation.line})`)
    .sort()
    .join("\n");
  assert.fail(
    "After an authoritative mutation commits, presentation must not write an authoritative "
    + "module repository locally. Use the authoritative response, a resource refresh or module "
    + "invalidation; keep local projection writes on an explicit demo-mode path.\n"
    + detail,
  );
}

console.log(
  `Post-commit projection writes: PASS (${authoritativeWriters.size} authoritative module writers derived; `
  + "0 presentation post-commit local writes).",
);
