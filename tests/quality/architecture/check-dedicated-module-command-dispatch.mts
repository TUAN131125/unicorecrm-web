import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { resolveCommandRoute, type HttpClient, type HttpRequest } from "../../../src/platform/api";
import { InvoiceHttpAdapter } from "../../../src/modules/invoices/infrastructure/http/InvoiceHttpAdapter";
import { createInvoiceVerticalSlice } from "../../../src/modules/invoices/application/vertical-slice/invoiceVerticalSlice";
import type { ReceivablesApiPort } from "../../../src/modules/invoices/application/ports/ReceivablesApiPort";
import { PaymentHttpAdapter } from "../../../src/modules/payments/infrastructure/http/PaymentHttpAdapter";
import { createPaymentVerticalSlice } from "../../../src/modules/payments/application/vertical-slice/paymentVerticalSlice";
import type { PaymentApiPort } from "../../../src/modules/payments/application/ports/PaymentApiPort";

/**
 * M1A-R invariant.
 *
 * A canonical command classified `PRODUCTION_CONTRACT_READY` with
 * `runtimeImplementationMode: DEDICATED_MODULE_HTTP_ADAPTER` is deliberately
 * excluded from `PRODUCTION_COMMAND_CONTRACTS` by
 * `scripts/api/openapi/render.mjs`. `RoutedHttpMutationAuthority` therefore
 * refuses it, so a connected production path that dispatches such a command
 * through the shared mutation authority is dead on arrival.
 *
 * The dedicated-module inventory below is derived from the canonical registry,
 * never from a hand-written list, so a registry change automatically widens or
 * narrows this gate.
 */

const root = repositoryRoot;

interface CanonicalCommand {
  commandType: string;
  status: string;
  runtimeImplementationMode: string;
  moduleOwner: string;
}

const registry = JSON.parse(
  fs.readFileSync(path.join(root, "docs/backend-readiness/command-registry.json"), "utf8"),
) as { commands: CanonicalCommand[] };

const dedicatedModuleCommands = new Map(
  registry.commands
    .filter((command) => (
      command.status === "PRODUCTION_CONTRACT_READY"
      && command.runtimeImplementationMode === "DEDICATED_MODULE_HTTP_ADAPTER"
    ))
    .map((command) => [command.commandType, command]),
);

assert.ok(
  dedicatedModuleCommands.size > 0,
  "The canonical registry must declare dedicated-module commands for this gate to be meaningful.",
);

/**
 * M4 invariant B. A READY command owned by a dedicated *workflow* adapter is excluded
 * from `PRODUCTION_COMMAND_CONTRACTS` by the same `render.mjs` rule, so dispatching it
 * through the shared authority is dead on arrival in connected mode.
 */
const dedicatedWorkflowCommands = new Map(
  registry.commands
    .filter((command) => (
      command.status === "PRODUCTION_CONTRACT_READY"
      && command.runtimeImplementationMode === "DEDICATED_WORKFLOW_HTTP_ADAPTER"
    ))
    .map((command) => [command.commandType, command]),
);

/**
 * M4 invariant C. A BLOCKED command has no production contract at all. It must not be
 * reachable as a connected routed production mutation: the boundary has to refuse before
 * the mutation authority is entered, rather than letting the routed authority discover it.
 */
const blockedCommands = new Map(
  registry.commands
    .filter((command) => command.status === "BLOCKED")
    .map((command) => [command.commandType, command]),
);

assert.ok(dedicatedWorkflowCommands.size > 0, "The canonical registry must declare dedicated-workflow commands.");
assert.ok(blockedCommands.size > 0, "The canonical registry must declare BLOCKED commands.");

/** Import aliases the shared mutation authority is dispatched through. */
const SHARED_DISPATCH_ALIASES = ["executeMutationCommand", "executeSharedMutationCommand"];

/**
 * A shared dispatch is permitted only when the same public boundary short-circuits
 * to the module's dedicated connected adapter before reaching it, which makes the
 * shared dispatch demo-only. The guard is proven from source rather than trusted
 * from a symbol name, so a boundary cannot be allow-listed by renaming it.
 */
const CONNECTED_SHORT_CIRCUIT = /if\s*\(\s*is[A-Za-z0-9_]*Connected[A-Za-z0-9_]*\s*\(\s*\)\s*\)\s*\{[\s\S]*?\breturn\b/u;

/**
 * A dedicated *workflow* boundary short-circuits on its own connected API runtime mode
 * (`if (api.mode === "connected") { ... return ... }`) before falling through to the demo
 * dispatch. That shape is proven from source, exactly like the module guard above.
 */
const CONNECTED_RUNTIME_SHORT_CIRCUIT = /if\s*\(\s*[A-Za-z0-9_$.]*\bmode\s*===\s*"connected"\s*\)\s*\{[\s\S]*?\breturn\b/u;

/**
 * A fail-closed availability guard: the boundary asks the active mutation authority
 * whether it can carry this exact canonical command and refuses first, so the command
 * never reaches the authority in a runtime that has no contract for it. The guard must
 * name the command type it protects, so an unrelated check cannot satisfy it.
 */
function hasAvailabilityGuard(boundary: string, commandType: string): boolean {
  const escaped = commandType.replaceAll(".", "\\.");
  return new RegExp(
    `\\b(?:assertMutationCommandSupported|isMutationCommandUnavailable|isMutationCommandSupported)\\s*\\(\\s*"${escaped}"`,
    "u",
  ).test(boundary);
}

/** Start of the nearest enclosing exported boundary. */
const BOUNDARY = /export\s+(?:async\s+)?(?:function|const|class)\s+[A-Za-z0-9_$]+/gu;

interface Dispatch {
  file: string;
  line: number;
  alias: string;
  commandType: string;
  shortCircuited: boolean;
}

/** Canonical classes this gate governs, derived from the registry above. */
type CanonicalClass = "dedicated-module" | "dedicated-workflow" | "blocked";

function readSourceFiles(): string[] {
  return walkFiles(path.join(root, "src"))
    .map((file: string) => file.split(path.sep).join("/"))
    .filter((file: string) => /\.tsx?$/u.test(file));
}

/** Extracts the balanced argument list that starts at `openIndex`. */
function readArgumentList(text: string, openIndex: number): string {
  let depth = 0;
  let index = openIndex;
  while (index < text.length) {
    if (text[index] === "(") depth += 1;
    else if (text[index] === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex + 1, index);
    }
    index += 1;
  }
  return "";
}

function enclosingBoundaryStart(text: string, dispatchIndex: number): number {
  BOUNDARY.lastIndex = 0;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = BOUNDARY.exec(text)) !== null) {
    if (match.index >= dispatchIndex) break;
    start = match.index;
  }
  return start;
}

function collectDispatches(): Dispatch[] {
  const dispatches: Dispatch[] = [];
  for (const file of readSourceFiles()) {
    const text = fs.readFileSync(file, "utf8");
    for (const alias of SHARED_DISPATCH_ALIASES) {
      const pattern = new RegExp(`\\b${alias}\\s*\\(`, "gu");
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const openIndex = match.index + match[0].length - 1;
        const args = readArgumentList(text, openIndex);
        const commandType = args.match(/commandType:\s*"([^"]+)"/u)?.[1];
        if (!commandType) continue;
        const boundary = text.slice(enclosingBoundaryStart(text, match.index), match.index);
        dispatches.push({
          file: path.relative(root, file).split(path.sep).join("/"),
          line: text.slice(0, match.index).split("\n").length,
          alias,
          commandType,
          shortCircuited: CONNECTED_SHORT_CIRCUIT.test(boundary)
            || CONNECTED_RUNTIME_SHORT_CIRCUIT.test(boundary)
            || hasAvailabilityGuard(boundary, commandType),
        });
      }
    }
  }
  return dispatches;
}

const dispatches = collectDispatches();

assert.ok(
  dispatches.length > 0,
  "No shared mutation dispatch site was found. The scanner is broken, not the source.",
);

const dedicatedDispatches = dispatches.filter((dispatch) => dedicatedModuleCommands.has(dispatch.commandType));

const violations = dedicatedDispatches.filter((dispatch) => !dispatch.shortCircuited);
const demoOnly = dedicatedDispatches.filter((dispatch) => dispatch.shortCircuited);

if (violations.length > 0) {
  const detail = violations
    .map((violation) => `  ${violation.commandType} -> ${violation.file}:${violation.line} (${violation.alias})`)
    .sort()
    .join("\n");
  assert.fail(
    "Dedicated-module commands must execute through their owning module's dedicated adapter, "
    + "never through RoutedHttpMutationAuthority. Reachable shared dispatches:\n"
    + detail,
  );
}

// A permitted demo-only dispatch must still name a real dedicated-module command,
// so the exception cannot be used to smuggle an unknown command type through.
for (const dispatch of demoOnly) {
  assert.ok(
    dedicatedModuleCommands.has(dispatch.commandType),
    `${dispatch.file}:${dispatch.line} short-circuits an unknown command type.`,
  );
}

// ---------------------------------------------------------------------------
// M4 invariant B: dedicated-workflow commands.
//
// `order.complete-from-fulfillment-evidence` and the three `lead.qualify-*` commands are
// READY but owned by dedicated workflow adapters, so the routed authority cannot carry
// them. A connected path must reach its own workflow adapter, or refuse before dispatch;
// it must never fall through to the shared authority with a local executor.
// ---------------------------------------------------------------------------

const workflowDispatches = dispatches.filter((dispatch) => dedicatedWorkflowCommands.has(dispatch.commandType));
const workflowViolations = workflowDispatches.filter((dispatch) => !dispatch.shortCircuited);

if (workflowViolations.length > 0) {
  const detail = workflowViolations
    .map((violation) => `  ${violation.commandType} -> ${violation.file}:${violation.line} (${violation.alias})`)
    .sort()
    .join("\n");
  assert.fail(
    "Dedicated-workflow commands must execute through their own connected workflow adapter, "
    + "or refuse before dispatch when that adapter does not exist. They must never reach "
    + "RoutedHttpMutationAuthority, and a connected path must never fall back to the local "
    + "workflow executor. Reachable shared dispatches:\n"
    + detail,
  );
}

// ---------------------------------------------------------------------------
// M4 invariant C: BLOCKED commands.
//
// A BLOCKED command has no production contract. Its boundary must refuse before the
// mutation authority is entered, so a connected caller cannot start a mutation that only
// fails deep inside routing, and can never silently fall back to a local write.
// ---------------------------------------------------------------------------

const blockedDispatches = dispatches.filter((dispatch) => blockedCommands.has(dispatch.commandType));
const blockedViolations = blockedDispatches.filter((dispatch) => !dispatch.shortCircuited);

if (blockedViolations.length > 0) {
  const detail = blockedViolations
    .map((violation) => `  ${violation.commandType} -> ${violation.file}:${violation.line} (${violation.alias})`)
    .sort()
    .join("\n");
  assert.fail(
    "A BLOCKED canonical command must not be reachable as a connected routed production "
    + "mutation. Guard the boundary with assertMutationCommandSupported(<commandType>, ...) "
    + "so connected mode fails closed before the mutation authority, while demo keeps its "
    + "local executor. Unguarded boundaries:\n"
    + detail,
  );
}

// The guards must stay honest: every guarded BLOCKED boundary still has to name a real
// canonical command, so the exception cannot be widened by guarding an invented type.
for (const dispatch of blockedDispatches) {
  assert.ok(
    blockedCommands.has(dispatch.commandType),
    `${dispatch.file}:${dispatch.line} guards an unknown command type.`,
  );
}

// ---------------------------------------------------------------------------
// Evidence preservation.
//
// The dispatch rule above only proves the shared authority is not used. The checks
// below prove the replacement path carries the backend's own mutation evidence
// rather than anything synthesized on the client. Distinct sentinel values are used
// so a client-side default could not accidentally satisfy an assertion.
// ---------------------------------------------------------------------------

const invoiceDocument = JSON.parse(
  fs.readFileSync(path.join(root, "tests/fixtures/backend-contract/issue-invoice-success.json"), "utf8"),
).result;

const INVOICE_EVIDENCE = {
  commandId: "cmd_sentinel_invoice_void_9F31",
  correlationId: "corr_sentinel_invoice_void_9F31",
  aggregateId: invoiceDocument.id,
  aggregateType: "INVOICE",
  version: 4207,
  occurredAt: "2026-08-01T04:05:06.000Z",
  outcome: "REPLAYED" as const,
  warnings: ["sentinel_invoice_warning"],
  emittedEventIds: ["evt_sentinel_invoice_void"],
  auditEvidenceIds: ["audit_sentinel_invoice_void"],
};

const invoiceRequests: HttpRequest[] = [];
const invoiceClient: HttpClient = {
  async request<TResponse>(request: HttpRequest): Promise<TResponse> {
    invoiceRequests.push(request);
    if (request.operationId === "voidInvoice") {
      return { ...INVOICE_EVIDENCE, result: { invoice: invoiceDocument } } as TResponse;
    }
    // Post-commit authoritative refresh reads. They run under Promise.allSettled,
    // so the shape only has to be plausible, never authoritative for this assertion.
    return [] as unknown as TResponse;
  },
};

const invoiceSlice = createInvoiceVerticalSlice(
  new InvoiceHttpAdapter(invoiceClient),
  { list: async () => [], summary: async () => ({}), aging: async () => ({}), accountStatement: async () => [] } as unknown as ReceivablesApiPort,
  { listAllocations: async () => [], listPaymentRecords: async () => [], listCustomerCredits: async () => [] } as unknown as PaymentApiPort,
);

const voided = await invoiceSlice.voidInvoice(invoiceDocument.id, { expectedVersion: 3, reason: "Sentinel void" });

assert.equal(voided.invoice.id, invoiceDocument.id, "The dedicated adapter must return the backend invoice.");
assert.equal(voided.evidence.authority, "backend");
assert.equal(voided.evidence.commandId, INVOICE_EVIDENCE.commandId);
assert.equal(voided.evidence.correlationId, INVOICE_EVIDENCE.correlationId);
assert.equal(voided.evidence.aggregateType, INVOICE_EVIDENCE.aggregateType);
assert.equal(voided.evidence.version, INVOICE_EVIDENCE.version);
assert.equal(voided.evidence.occurredAt, INVOICE_EVIDENCE.occurredAt);
assert.equal(voided.evidence.outcome, INVOICE_EVIDENCE.outcome);
assert.deepEqual([...voided.evidence.warnings], INVOICE_EVIDENCE.warnings);
assert.deepEqual([...voided.evidence.emittedEventIds], INVOICE_EVIDENCE.emittedEventIds);
assert.deepEqual([...voided.evidence.auditEvidenceIds], INVOICE_EVIDENCE.auditEvidenceIds);
assert.equal(
  invoiceRequests.find((request) => request.operationId === "voidInvoice")?.path,
  `/invoices/${invoiceDocument.id}/void`,
  "invoice.void must reach its dedicated OpenAPI operation.",
);
assert.equal(
  invoiceRequests.find((request) => request.operationId === "voidInvoice")?.expectedVersion,
  3,
  "invoice.void must carry optimistic concurrency to the dedicated adapter.",
);
assert.ok(
  invoiceRequests.some((request) => request.operationId !== "voidInvoice"),
  "A dedicated Invoice mutation must still trigger the authoritative refresh reads.",
);

const PAYMENT_EVIDENCE = {
  commandId: "cmd_sentinel_manual_payment_4B77",
  correlationId: "corr_sentinel_manual_payment_4B77",
  aggregateId: "pay_sentinel_0001",
  aggregateType: "PAYMENT_RECORD",
  version: 8815,
  occurredAt: "2026-08-02T07:08:09.000Z",
  outcome: "COMMITTED" as const,
  warnings: [],
  emittedEventIds: ["evt_sentinel_manual_payment"],
  auditEvidenceIds: ["audit_sentinel_manual_payment"],
};

const paymentDocument = {
  id: PAYMENT_EVIDENCE.aggregateId,
  buyerRef: { type: "CONTACT", id: "buyer_sentinel" },
  amount: { amount: "1000", currency: "VND" },
  methodCode: "BANK_TRANSFER",
  channel: "BANK",
  state: "RECORDED",
  occurredAt: PAYMENT_EVIDENCE.occurredAt,
  appliedAmount: { amount: "0", currency: "VND" },
  unappliedAmount: { amount: "1000", currency: "VND" },
  version: 1,
  createdAt: PAYMENT_EVIDENCE.occurredAt,
  updatedAt: PAYMENT_EVIDENCE.occurredAt,
};

const paymentRequests: HttpRequest[] = [];
const paymentClient: HttpClient = {
  async request<TResponse>(request: HttpRequest): Promise<TResponse> {
    paymentRequests.push(request);
    if (request.operationId === "recordManualPayment") {
      return { ...PAYMENT_EVIDENCE, result: { payment: paymentDocument } } as TResponse;
    }
    return [] as unknown as TResponse;
  },
};

const paymentSlice = createPaymentVerticalSlice(new PaymentHttpAdapter(paymentClient));
const manualPayment = await paymentSlice.recordManualPayment({
  id: PAYMENT_EVIDENCE.aggregateId,
  buyerRef: { type: "CONTACT", id: "buyer_sentinel" },
  amount: { amount: "1000", currency: "VND" },
  methodCode: "BANK_TRANSFER",
  channel: "BANK",
  occurredAt: PAYMENT_EVIDENCE.occurredAt,
  idempotencyKey: "manual-payment-sentinel",
  now: PAYMENT_EVIDENCE.occurredAt,
  allowUnapplied: false,
} as Parameters<PaymentApiPort["recordManualPayment"]>[0]);

assert.equal(manualPayment.payment.id, PAYMENT_EVIDENCE.aggregateId);
assert.equal(manualPayment.evidence.authority, "backend");
assert.equal(manualPayment.evidence.commandId, PAYMENT_EVIDENCE.commandId);
assert.equal(manualPayment.evidence.correlationId, PAYMENT_EVIDENCE.correlationId);
assert.equal(manualPayment.evidence.aggregateType, PAYMENT_EVIDENCE.aggregateType);
assert.equal(manualPayment.evidence.version, PAYMENT_EVIDENCE.version);
assert.equal(manualPayment.evidence.occurredAt, PAYMENT_EVIDENCE.occurredAt);
assert.equal(manualPayment.evidence.outcome, PAYMENT_EVIDENCE.outcome);
assert.deepEqual([...manualPayment.evidence.emittedEventIds], PAYMENT_EVIDENCE.emittedEventIds);
assert.deepEqual([...manualPayment.evidence.auditEvidenceIds], PAYMENT_EVIDENCE.auditEvidenceIds);
assert.equal(
  paymentRequests.find((request) => request.operationId === "recordManualPayment")?.path,
  "/payments/manual-records",
  "payment.record-manual must reach its dedicated OpenAPI operation.",
);
assert.equal(
  paymentRequests.find((request) => request.operationId === "recordManualPayment")?.idempotencyKey,
  "manual-payment-sentinel",
  "payment.record-manual must carry its idempotency key to the dedicated adapter.",
);

// A dedicated adapter must refuse a response that omits authoritative evidence
// instead of defaulting it, otherwise the client would be inventing the record.
const evidencelessClient: HttpClient = {
  async request<TResponse>(): Promise<TResponse> {
    return { aggregateId: invoiceDocument.id, result: { invoice: invoiceDocument } } as TResponse;
  },
};
await assert.rejects(
  new InvoiceHttpAdapter(evidencelessClient).voidInvoice(invoiceDocument.id, { expectedVersion: 3, reason: "No evidence" }),
  /CONNECTED_CONTRACT_VIOLATION:voidInvoice:missing-evidence/u,
  "A dedicated Invoice mutation must reject a response carrying no authoritative evidence.",
);

// The public boundary must project backend evidence, never manufacture it.
for (const relative of ["src/modules/invoices/public/api.ts", "src/modules/payments/public/api.ts"]) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  assert.ok(/commandId: evidence\.commandId/u.test(source), `${relative} must take commandId from backend evidence.`);
  assert.ok(/correlationId: evidence\.correlationId/u.test(source), `${relative} must take correlationId from backend evidence.`);
  assert.ok(/occurredAt: evidence\.occurredAt/u.test(source), `${relative} must take occurredAt from backend evidence.`);
  assert.ok(/version: evidence\.version/u.test(source), `${relative} must take version from backend evidence.`);
  assert.ok(/evidenceIds: \[\.\.\.evidence\.auditEvidenceIds\]/u.test(source), `${relative} must take audit evidence from the backend.`);
  assert.equal(/commandId: crypto\./u.test(source), false, `${relative} must not synthesize a command id.`);
  assert.equal(/occurredAt: new Date\(/u.test(source), false, `${relative} must not synthesize an occurredAt.`);
}

// Routed commands must keep using the generic authority.
for (const commandType of [
  "invoice.create-draft",
  "invoice.save-draft",
  "invoice.issue",
  "payment.allocate",
  "payment.create-intent",
  "payment.record-cod-collection",
]) {
  assert.ok(resolveCommandRoute(commandType).operationId, `${commandType} must stay a routed production command.`);
}

// BLOCKED commands must stay blocked.
const canonicalStatus = new Map(registry.commands.map((command) => [command.commandType, command.status]));
for (const commandType of ["invoice.allocate-receivable", "payment.refresh-intent-status"]) {
  assert.equal(canonicalStatus.get(commandType), "BLOCKED", `${commandType} must remain BLOCKED in the canonical registry.`);
  assert.throws(
    () => resolveCommandRoute(commandType),
    /not classified PRODUCTION_CONTRACT_READY/u,
    `${commandType} must stay refused by the routed authority.`,
  );
}

console.log(
  `Canonical command dispatch integrity: PASS (${dedicatedModuleCommands.size} dedicated-module, `
  + `${dedicatedWorkflowCommands.size} dedicated-workflow and ${blockedCommands.size} BLOCKED canonical commands; `
  + `${dispatches.length} shared dispatch sites scanned; ${demoOnly.length} demo-only short-circuited; `
  + `${workflowDispatches.length} workflow and ${blockedDispatches.length} BLOCKED boundaries all guarded; `
  + "0 reachable violations; backend evidence preserved end-to-end for Invoice and Payment).",
);
for (const dispatch of demoOnly.sort((left, right) => left.commandType.localeCompare(right.commandType))) {
  console.log(`  demo-only short-circuit: ${dispatch.commandType} (${dispatch.file}:${dispatch.line})`);
}
