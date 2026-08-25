// Behaviour contract for M10 / RC-08 safe user-facing failure presentation (MA-08).
//
// Real errors from the M4–M9 refusal paths are put through the central presentation and
// the resulting user copy is asserted: it must never carry internal topology, and it must
// not flatten the semantic distinctions M9 established.
import assert from "node:assert/strict";
import {
  presentApplicationError,
  formatApplicationError,
  UNSAFE_FOR_DISPLAY_CODES,
  unavailableMessages,
} from "../../../src/shared/operations/errorPresentation";
import {
  formatOperationUnavailableError,
  backendUnavailableMessage,
} from "../../../src/shared/operations/backendAvailability";
import { MutationCommandError } from "../../../src/shared/application/mutation/mutationAuthority";
import { describePartialCommit } from "../../../src/shared/operations/partialCommit";

/** Fragments that must never appear in user copy. */
const INTERNAL_FRAGMENTS = [
  "WF-01", "WF-04", "WF-21",
  "BLOCKED",
  "routable production command contract",
  "connected frontend may not coordinate",
  "workflow-ownership.json",
  "command-registry.json",
  "adapter",
  "resource version",
  "local executor",
  "Idempotency key",
  "CONNECTED_",
];

function assertSafe(message: string, context: string): void {
  for (const fragment of INTERNAL_FRAGMENTS) {
    assert.ok(
      !message.toLowerCase().includes(fragment.toLowerCase()),
      `${context}: user copy must not contain internal detail "${fragment}". Got: ${message}`,
    );
  }
  assert.ok(message.trim().length > 0, `${context}: user copy must not be empty.`);
}

// ---------------------------------------------------------------------------
// A. Architecture refusals — the real errors M6/M7/M8 raise.
// ---------------------------------------------------------------------------

const workflowRefusal = new MutationCommandError({
  code: "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN",
  message: "Creating a commercial opportunity for a Customer cannot run in connected mode: "
    + "WF-04 customer-commercial-actions is BLOCKED and the connected frontend may not coordinate it.",
  category: "INFRASTRUCTURE",
  retryable: false,
  details: { workflowId: "WF-04", authority: "docs/backend-readiness/workflow-ownership.json" },
});

for (const locale of ["en", "vi"]) {
  assertSafe(formatApplicationError(workflowRefusal, { locale }), `workflow refusal (${locale})`);
  assertSafe(formatOperationUnavailableError(workflowRefusal, { locale }), `workflow refusal via unavailable formatter (${locale})`);
}

const contractBlocked = new MutationCommandError({
  code: "CONNECTED_COMMAND_CONTRACT_BLOCKED",
  message: "Completing the order cannot run in connected mode: order.complete-from-fulfillment-evidence "
    + "is not a routable production command contract.",
  category: "INFRASTRUCTURE",
});
assertSafe(formatApplicationError(contractBlocked), "contract blocked");

const versionRequired = new MutationCommandError({
  code: "DEAL_RESOURCE_VERSION_REQUIRED",
  message: "deal.update requires an authoritative Deal resource version.",
  category: "CONFLICT",
});
assertSafe(formatApplicationError(versionRequired), "resource version required");

// Every declared unsafe code must produce safe copy, so a new declaration cannot be added
// without the mapping actually covering it.
for (const code of UNSAFE_FOR_DISPLAY_CODES) {
  const error = new MutationCommandError({
    code,
    message: `INTERNAL DIAGNOSTIC for ${code}: WF-21 BLOCKED adapter resource version`,
    category: "INFRASTRUCTURE",
  });
  assertSafe(formatApplicationError(error), `declared unsafe code ${code}`);
  assert.ok(
    !formatApplicationError(error).includes("INTERNAL DIAGNOSTIC"),
    `${code}: the internal message must not be rendered.`,
  );

  // The case the declaration actually exists for (M11).
  //
  // With no `userMessage`, an unmapped code still lands on safe category copy, so the two
  // assertions above hold whether or not the code is recognised — a negative control that
  // disabled the recognition entirely left this gate green. Recognition only does work when a
  // throw site HAS set a `userMessage`: then it is the only thing standing between the
  // diagnostic and the user, and the result must be the shared unavailable sentence rather
  // than whatever the throw site called product copy.
  const selfDescribed = new MutationCommandError({
    code,
    message: `INTERNAL DIAGNOSTIC for ${code}`,
    userMessage: `INTERNAL DIAGNOSTIC for ${code}: WF-21 BLOCKED adapter resource version`,
    category: "INFRASTRUCTURE",
  });
  for (const locale of ["en", "vi"]) {
    const copy = formatApplicationError(selfDescribed, { locale });
    assertSafe(copy, `declared unsafe code ${code} with a self-supplied userMessage (${locale})`);
    assert.ok(
      !copy.includes("INTERNAL DIAGNOSTIC"),
      `${code}: a userMessage set at the throw site must not override the architecture-refusal mapping.`,
    );
    assert.equal(
      copy,
      locale === "vi" ? unavailableMessages.vi : unavailableMessages.en,
      `${code}: an architecture refusal must render the shared unavailable sentence, not category copy and not `
        + "the throw site's own wording.",
    );
  }
}

// ---------------------------------------------------------------------------
// B. Unknown errors — a plain exception carrying sensitive internal detail.
// ---------------------------------------------------------------------------

const unknown = new Error("sensitive internal detail: /srv/app/src/platform/api/runtime/RoutedHttpMutationAuthority.ts:258");
const unknownCopy = formatApplicationError(unknown);
assert.ok(
  !unknownCopy.includes("sensitive internal detail"),
  `Unknown errors must not render their message. Got: ${unknownCopy}`,
);
assert.ok(!unknownCopy.includes("RoutedHttpMutationAuthority"), "Unknown errors must not render source paths.");
assert.ok(unknownCopy.length > 0, "Unknown errors must still produce feedback, not silence.");

// ---------------------------------------------------------------------------
// C. Explicit safe copy is preserved.
// ---------------------------------------------------------------------------

const businessRule = new MutationCommandError({
  code: "DEAL_NOT_WON",
  message: "The source Deal Acme Expansion must be Won before creating an Order.",
  userMessage: "The source Deal Acme Expansion must be Won before creating an Order.",
  category: "BUSINESS_RULE",
});
assert.equal(
  formatApplicationError(businessRule),
  "The source Deal Acme Expansion must be Won before creating an Order.",
  "A throw site that supplies product-safe copy must keep it.",
);

const conflict = new MutationCommandError({
  code: "ORDER_VERSION_CONFLICT",
  message: "The Order changed after this form was opened. Reload before saving again.",
  userMessage: "The Order changed after this form was opened. Reload before saving again.",
  category: "CONFLICT",
});
assert.match(formatApplicationError(conflict), /Reload before saving again/u, "Safe conflict guidance must survive.");
assert.equal(presentApplicationError(conflict).action, "REFRESH", "Conflict must still recommend a refresh.");

// ---------------------------------------------------------------------------
// D. Category distinctions are preserved — not everything becomes "unavailable".
// ---------------------------------------------------------------------------

const network = new MutationCommandError({ code: "NETWORK_REQUEST_FAILED", message: "fetch failed", category: "NETWORK" });
const networkCopy = formatApplicationError(network);
assert.ok(!networkCopy.includes("fetch failed"), "The transport diagnostic must not be rendered.");
assert.notEqual(
  networkCopy,
  backendUnavailableMessage({}),
  "A transient network failure must not be reported as an unreleased feature.",
);
assert.equal(presentApplicationError(network).retryable || presentApplicationError(network).action === "RETRY", true);

assert.notEqual(
  formatApplicationError(new MutationCommandError({ code: "AUTHORIZATION_DENIED", message: "x", category: "AUTHORIZATION" })),
  formatApplicationError(workflowRefusal),
  "Permission failures and unavailable features must not read identically.",
);

// ---------------------------------------------------------------------------
// E. The technical identity of the error is preserved for diagnostics.
// ---------------------------------------------------------------------------

const presented = presentApplicationError(workflowRefusal);
assert.equal(presented.error.code, "CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN", "The stable code must survive.");
assert.match(presented.error.message, /WF-04/u, "The internal diagnostic must remain on the error for logs and tests.");
assert.deepEqual(
  (presented.error.details as { workflowId?: string }).workflowId,
  "WF-04",
  "Structured diagnostic details must survive.",
);

// ---------------------------------------------------------------------------
// F. M9 partial-success semantics are not flattened.
// ---------------------------------------------------------------------------

const partial = {
  status: "PARTIAL_SUCCESS" as const,
  committed: [{ step: "profile" }],
  failedStep: "forecast",
  error: workflowRefusal,
  requiresRefresh: true,
};
const partialCopy = describePartialCommit(partial, { committed: "The opportunity details", failed: "the forecast" }, "en");
assert.match(partialCopy, /was saved/u, "A partial success must still say something was saved.");
assert.ok(!/^nothing/iu.test(partialCopy), "A partial success must not read as a total failure.");
assert.ok(!/roll(ed)? back/iu.test(partialCopy), "A partial success must never claim a rollback.");
assertSafe(`${partialCopy} ${formatApplicationError(partial.error)}`, "partial-success sentence plus failure");

assert.equal(
  describePartialCommit({ ...partial, status: "NO_COMMIT_FAILURE" }, { committed: "x", failed: "y" }, "en"),
  "",
  "A no-commit failure must not be described as a partial success.",
);

console.log(
  `quality.user-facing-error-presentation: PASS (${UNSAFE_FOR_DISPLAY_CODES.size} architecture codes mapped to safe `
    + "copy, unknown errors sanitised, safe copy preserved, categories distinct, diagnostics intact, partial success "
    + "not flattened).",
);
