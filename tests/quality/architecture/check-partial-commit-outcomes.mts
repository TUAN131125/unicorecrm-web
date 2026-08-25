import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";

/**
 * MA-07 invariant (M9) — RC-07 partial-commit semantics.
 *
 * When one connected user action issues several authoritative backend mutations in
 * sequence, an earlier command can commit before a later one fails. The frontend must not
 * then behave as if nothing committed: the committed outcome has to survive, be reported,
 * and leave the authoritative projection refreshed.
 *
 * This gate does not try to infer intent from arbitrary code. It derives the authoritative
 * command vocabulary from the module public boundaries, finds handlers that issue two or
 * more of them, and requires every such handler to be pinned with an explicit reason it is
 * safe. A new multi-command handler therefore fails until it is classified.
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

/** Index just past the `)` that closes the `(` at `open`, or -1. */
function balancedParens(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    else if (text[index] === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

/** Text of a balanced run starting at `open`. */
function balanced(text: string, open: number): string {
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

// ---------------------------------------------------------------------------
// 1. The authoritative command vocabulary, derived from module public boundaries.
// ---------------------------------------------------------------------------

const authoritativeCommands = new Set<string>();
for (const file of sourceFiles) {
  if (!/\/modules\/[a-z-]+\/public\//u.test(file)) continue;
  const text = read.get(file)!;
  // `*Command` / `*CommandBoundary` are the command wrappers; `*ViaApi` are the
  // authoritative activity writes, which commit exactly like a command does.
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_$]*(?:Command(?:Boundary)?|ViaApi))\b/gu)) {
    authoritativeCommands.add(match[1]);
  }
}
assert.ok(
  authoritativeCommands.size > 10,
  `The authoritative command vocabulary must be derived from the module public boundaries (found ${authoritativeCommands.size}).`,
);

const commandCallPattern = new RegExp(
  `\\b(${[...authoritativeCommands].sort().join("|")})\\s*\\(`,
  "gu",
);

// ---------------------------------------------------------------------------
// 2. Handlers that issue two or more distinct authoritative commands.
// ---------------------------------------------------------------------------

interface Sequence { file: string; handler: string; commands: string[]; body: string; start: number; end: number }

const sequences: Sequence[] = [];
for (const file of sourceFiles) {
  if (!/\/(presentation|workflows)\//u.test(file) && !/^src\/workflows\//u.test(relative(file))) continue;
  const text = read.get(file)!;
  const found: Sequence[] = [];
  // Parameter lists span lines and nest, so the opening `(` is balanced explicitly rather
  // than matched with `[^)]*` — otherwise a handler with a destructured or typed parameter
  // is missed and only its enclosing controller hook is reported.
  for (const match of text.matchAll(/(?:const|(?:export\s+)?(?:async\s+)?function)\s+([A-Za-z0-9_$]+)\s*(?:=\s*)?(?:async\s*)?\(/gu)) {
    const parenOpen = text.lastIndexOf("(", match.index! + match[0].length);
    const afterParams = balancedParens(text, parenOpen);
    if (afterParams < 0) continue;
    const open = text.indexOf("{", afterParams);
    // Only a body that starts right after the signature belongs to this function.
    if (open < 0 || /[;)]/u.test(text.slice(afterParams, open).replace(/=>|:\s*[A-Za-z0-9_$<>,.\[\]|\s]*/gu, ""))) continue;
    const body = balanced(text, open);
    const called = [...new Set([...body.matchAll(commandCallPattern)].map((hit) => hit[1]))];
    if (called.length >= 2) {
      found.push({ file: relative(file), handler: match[1], commands: called.sort(), body, start: open, end: open + body.length });
    }
  }
  // Keep only the innermost handler for each region: a controller hook lexically contains
  // every handler it defines, and reporting the container would say nothing about which
  // action can actually partially commit.
  for (const candidate of found) {
    const containsAnother = found.some((other) => other !== candidate && other.start >= candidate.start && other.end <= candidate.end);
    if (!containsAnother) sequences.push(candidate);
  }
}

/**
 * Every connected multi-command sequence, with the reason it cannot misreport a partial
 * commit. The comparison is exact: a new or renamed multi-command handler fails this gate
 * until it is classified.
 *
 * PARTIAL_OUTCOME_AWARE — reports which commands committed when a later one fails.
 * CONTAINED            — refuses before the first mutation in connected mode (M6/M7/M8).
 * DEMO_ONLY            — cannot run against backend authority.
 */
const pinnedSequences: Record<string, "PARTIAL_OUTCOME_AWARE" | "STEPWISE_REPORTED" | "CONTAINED" | "SINGLE_COMMAND_PER_RUN"> = {
  // Several authoritative Deal commands; no backend operation covers them together.
  "src/modules/deals/presentation/hooks/useDealPipelineController.ts -> handleEditDealSubmit": "PARTIAL_OUTCOME_AWARE",

  // Save-then-act: `persistCurrentQuote` commits and reports on its own, then approval or
  // send runs and reports on its own. A failed second step cannot erase the saved quote,
  // because the save already reported success before it started.
  "src/modules/quotes/presentation/hooks/useQuoteBuilderController.tsx -> useQuoteBuilderController": "STEPWISE_REPORTED",

  // Bulk order actions, settled per item and reported on both sides.
  "src/modules/orders/presentation/hooks/useOrderListController.tsx -> useOrderListController": "PARTIAL_OUTCOME_AWARE",

  // Refuse before the first mutation (M6/M7).
  "src/modules/contacts/presentation/hooks/useContactListController.tsx -> handleCommitOpportunity": "CONTAINED",
  "src/workflows/customer-commercial-actions/index.ts -> createDealForCustomer": "CONTAINED",

  // Mutually exclusive branches: archive OR restore, create OR replace. Exactly one
  // authoritative command runs per invocation, so there is no sequence to partially commit.
  "src/modules/contacts/presentation/hooks/useContactDetailController.tsx -> handleArchiveToggle": "SINGLE_COMMAND_PER_RUN",
  "src/modules/contacts/presentation/hooks/useContactListController.tsx -> handleToggleArchiveContact": "SINGLE_COMMAND_PER_RUN",
  "src/modules/products/presentation/hooks/useProductListController.ts -> handleArchiveToggle": "SINGLE_COMMAND_PER_RUN",
  "src/modules/products/presentation/pages/ProductDetailPage.tsx -> handleArchiveToggle": "SINGLE_COMMAND_PER_RUN",
  "src/modules/support/presentation/pages/SupportCaseFormPage.tsx -> save": "SINGLE_COMMAND_PER_RUN",
  // Separate handlers on one controller; each issues a single authoritative command.
  "src/modules/deals/presentation/hooks/useDealDetailController.tsx -> useDealDetailController": "SINGLE_COMMAND_PER_RUN",
};

const observed = sequences.map((entry) => `${entry.file} -> ${entry.handler}`).sort();
assert.deepEqual(
  observed,
  Object.keys(pinnedSequences).sort(),
  "Every connected handler that issues two or more authoritative commands must be pinned with the reason it cannot "
    + "misreport a partial commit.\nObserved:\n" + observed.join("\n"),
);

for (const entry of sequences) {
  const key = `${entry.file} -> ${entry.handler}`;
  const classification = pinnedSequences[key];
  if (classification === "PARTIAL_OUTCOME_AWARE") {
    assert.match(
      entry.body,
      /(?:executeSequentialCommits|summarizeBulkCommits)\s*\(/u,
      `${key} issues ${entry.commands.join(" + ")} in sequence. An earlier command can commit before a later one `
        + "fails, so it must run them through the partial-commit reporter.",
    );
    // Producing a report is not enough: the caller has to branch on it, or the committed
    // steps are still invisible to the user.
    //
    // The check is structural rather than text-presence (M11). Requiring only that
    // `"PARTIAL_SUCCESS"` appears somewhere in the body is satisfied by a branch that can
    // never run: replacing the outcome guard with a constant-false condition leaves every
    // mention of the status intact inside dead code, and the gate stayed green. So the
    // outcome guard has to exist as a guard, and the partial handling has to live inside it.
    const outcomeGuard = /\bif\s*\(\s*[A-Za-z0-9_$.]*\.status\s*!==\s*"FULL_SUCCESS"\s*\)\s*\{/u.exec(entry.body);
    assert.ok(
      outcomeGuard,
      `${key} must branch on the partial-commit report's own status. Computing the report and ignoring it — or `
        + "gating it behind any other condition — leaves a committed step silent.",
    );
    const guardedBlock = balanced(entry.body, entry.body.indexOf("{", outcomeGuard.index + outcomeGuard[0].length - 1));
    assert.match(
      guardedBlock,
      /"PARTIAL_SUCCESS"/u,
      `${key} must distinguish a partial commit from a total failure inside its outcome guard.`,
    );
    assert.match(
      guardedBlock,
      /\.committed\b/u,
      `${key} must report the committed steps the backend kept, not only the step that failed.`,
    );
  }
  if (classification === "STEPWISE_REPORTED") {
    // Each authoritative command must own a failure path, so no step can fail silently
    // behind another step's success message.
    const catches = [...entry.body.matchAll(/catch\s*\(/gu)].length;
    assert.ok(
      catches >= entry.commands.length,
      `${key} is pinned as STEPWISE_REPORTED: each of ${entry.commands.join(" + ")} must have its own failure path `
        + `(found ${catches} catch blocks for ${entry.commands.length} commands).`,
    );
  }
  if (classification === "CONTAINED") {
    assert.match(
      entry.body,
      /isContactOpportunityCreationUnavailable|refuseUnavailableContactOpportunity|isCustomerCommercialActionsUnavailable|assertCustomerCommercialActionsAvailable|isWorkActivationUnavailable/u,
      `${key} is pinned as CONTAINED, so it must still refuse before its first mutation.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Bulk authoritative mutations must retain per-item outcomes.
// ---------------------------------------------------------------------------

/**
 * Bulk `Promise.all` over authoritative commands that is unreachable today because the
 * action refuses before dispatch. The shape is still unsafe — a single rejection would
 * discard the items that already committed — so each is pinned with the containment that
 * makes it moot, and must be converted to per-item settlement when that contract lands.
 */
const containedBulkFanOut: Record<string, RegExp> = {
  // `customer.archive` is BLOCKED; the batch is refused before any item is dispatched.
  "src/modules/customers/presentation/pages/CustomerListPage.tsx": /isCustomerRetentionUnavailable\(\)/u,
};

for (const file of sourceFiles) {
  const text = read.get(file)!;
  for (const match of text.matchAll(/Promise\.all\s*\(/gu)) {
    const window = text.slice(match.index!, match.index! + 400);
    commandCallPattern.lastIndex = 0;
    if (!commandCallPattern.test(window)) continue;
    commandCallPattern.lastIndex = 0;
    const contained = containedBulkFanOut[relative(file)];
    assert.ok(
      contained && contained.test(text),
      `${relative(file)} fans authoritative mutations out through Promise.all. A single rejection discards the `
        + "outcomes of the items that already committed; use per-item settlement and report both sides.",
    );
  }
}

/**
 * Bulk flows that settle per item. Each must report which items committed, not only which
 * failed — otherwise the user cannot tell a full failure from a partial one.
 */
const bulkSettledFlows = [
  "src/modules/orders/presentation/hooks/useOrderListController.tsx",
];
for (const file of bulkSettledFlows) {
  const text = sourceOf(file);
  assert.match(text, /Promise\.allSettled/u, `${file} must settle bulk authoritative mutations per item.`);
  assert.match(
    text,
    /summarizeBulkCommits/u,
    `${file} must summarise per-item settlement so the items that committed are reported, not only the failures.`,
  );
}

// ---------------------------------------------------------------------------
// 4. No frontend compensation. Reversing a committed command from the frontend is a new
//    distributed workflow, not a fix: `compensationOwner` is BACKEND.
// ---------------------------------------------------------------------------

const partialOutcomeModule = "src/shared/operations/partialCommit.ts";
for (const entry of sequences) {
  const compensation = /catch\s*\([^)]*\)\s*\{[^}]*(?:archive|delete|cancel|restore)[A-Za-z]*Command/isu;
  assert.doesNotMatch(
    entry.body,
    compensation,
    `${entry.file} -> ${entry.handler} must not compensate a committed command from a catch block.`,
  );
}

const partialModule = sourceOf(partialOutcomeModule);
assert.doesNotMatch(
  partialModule,
  /Command\s*\(/u,
  "The partial-commit reporter must only describe outcomes. Issuing a command from it would make it a compensation "
    + "orchestrator.",
);

console.log(
  `quality.partial-commit-outcomes: ${authoritativeCommands.size} authoritative commands, `
    + `${sequences.length} multi-command sequences pinned, bulk flows settle per item, zero frontend compensation.`,
);
