import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { initializeApplicationComposition } from "../../../src/app/composition/applicationComposition";
import { getInvoiceApplicationServices } from "../../../src/modules/invoices/application/composition/invoiceApplicationServices";
import { getPaymentApplicationServices } from "../../../src/modules/payments/application/composition/paymentApplicationServices";
import { createPaymentVerticalSlice } from "../../../src/modules/payments/application/vertical-slice/paymentVerticalSlice";
import type { PaymentApiPort } from "../../../src/modules/payments/application/ports/PaymentApiPort";
import { createAuthoritativeResource } from "../../../src/shared/application/authoritativeResource";

const root = repositoryRoot;

const financialPresentationFiles = [
  "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx",
  "src/modules/payments/presentation/pages/PaymentDetailPage.tsx",
  "src/modules/payments/presentation/components/PaymentRequestComposer.tsx",
  "src/modules/invoices/presentation/pages/InvoiceListPage.tsx",
  "src/modules/invoices/presentation/pages/InvoiceDetailPage.tsx",
  "src/modules/invoices/presentation/pages/InvoiceFormPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivablesPage.tsx",
  "src/modules/invoices/presentation/pages/ReceivableDetailPage.tsx",
  "src/modules/invoices/presentation/pages/AccountStatementPage.tsx",
];

const forbiddenPresentationSymbols = [
  "getPaymentsSnapshot",
  "getInvoicesSnapshot",
  "getInvoiceSnapshot",
  "getReceivablesSnapshot",
  "subscribeToPayments",
  "subscribeToInvoices",
  "recordManualPaymentSnapshot",
  "createPaymentIntentSnapshot",
  "allocatePaymentToInvoicesSnapshot",
  "reverseInvoiceAllocationSnapshot",
  "createInvoiceDraftSnapshot",
  "saveInvoiceDraftSnapshot",
  "issueInvoiceSnapshot",
  "sendInvoiceSnapshot",
  "createCreditNoteSnapshot",
  "discardInvoiceDraftSnapshot",
  "voidInvoiceSnapshot",
  "allocateReceivableSnapshot",
];

for (const relative of financialPresentationFiles) {
  const absolute = path.join(root, relative);
  assert.ok(
    fs.existsSync(absolute),
    `Missing financial presentation surface: ${relative}`,
  );
  const source = fs.readFileSync(absolute, "utf8");
  for (const symbol of forbiddenPresentationSymbols) {
    assert.doesNotMatch(
      source,
      new RegExp(`\\b${symbol}\\b`),
      `${relative} must not use legacy browser-authority symbol ${symbol}.`,
    );
  }
}

const requiredSourceEvidence: Record<string, RegExp[]> = {
  "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx": [
    /usePaymentWorkspaceQuery/,
    /recordManualPaymentCanonical/,
    /createPaymentIntentCanonical/,
  ],
  "src/modules/payments/presentation/pages/PaymentDetailPage.tsx": [
    /usePaymentRecordDetailQuery/,
    /reconcilePaymentRecordCanonical/,
    /reversePaymentAllocationCanonical/,
  ],
  "src/modules/invoices/presentation/pages/InvoiceListPage.tsx": [
    /useInvoiceWorkspaceQuery/,
  ],
  "src/modules/invoices/presentation/pages/InvoiceFormPage.tsx": [
    /useInvoiceWorkspaceQuery/,
    /createInvoiceDraftCanonical/,
    /saveInvoiceDraftCanonical/,
    /existing\.version/,
  ],
  "src/modules/invoices/presentation/pages/InvoiceDetailPage.tsx": [
    /useInvoiceDetailQuery/,
    /issueInvoiceCanonical/,
    /classifyMutationFailure/,
    /CONFLICTED/,
  ],
  "src/modules/invoices/presentation/pages/ReceivablesPage.tsx": [
    /useReceivablesWorkspaceQuery/,
  ],
  "src/modules/invoices/presentation/pages/ReceivableDetailPage.tsx": [
    /useReceivableDetailQuery/,
    /allocateReceivableCanonical/,
    /reversePaymentAllocationCanonical/,
  ],
  "src/modules/invoices/presentation/pages/AccountStatementPage.tsx": [
    /useAccountStatementQuery/,
  ],
};

for (const [relative, patterns] of Object.entries(requiredSourceEvidence)) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  for (const pattern of patterns)
    assert.match(
      source,
      pattern,
      `${relative} is missing vertical-slice evidence ${pattern}.`,
    );
}

const resourceSource = fs.readFileSync(
  path.join(root, "src/shared/application/authoritativeResource.ts"),
  "utf8",
);
assert.match(resourceSource, /AbortController/);
assert.match(resourceSource, /refresh:\s*\(\)\s*=>\s*run\(true\)/);
assert.match(resourceSource, /state:\s*"ERROR"/);

let successfulLoads = 0;
const resource = createAuthoritativeResource(async () => ({
  version: ++successfulLoads,
}));
assert.equal(resource.getSnapshot().state, "IDLE");
assert.deepEqual(await resource.load(), { version: 1 });
assert.equal(resource.getSnapshot().state, "READY");
assert.deepEqual(await resource.refresh(), { version: 2 });
assert.equal(resource.getSnapshot().data?.version, 2);

let cancellationObserved = false;
const cancellable = createAuthoritativeResource(
  (_signal) =>
    new Promise<{ ok: true }>((resolve, reject) => {
      _signal.addEventListener(
        "abort",
        () => {
          cancellationObserved = true;
          reject(new DOMException("cancelled", "AbortError"));
        },
        { once: true },
      );
      void resolve;
    }),
);
const pending = cancellable.load();
cancellable.cancel();
await pending;
assert.equal(cancellationObserved, true);
assert.equal(cancellable.getSnapshot().state, "IDLE");

let paymentWorkspaceReads = 0;
const fakePaymentApi = new Proxy(
  {},
  {
    get(_target, property) {
      if (property === "getMethodCatalog")
        return async () => {
          paymentWorkspaceReads += 1;
          return { methods: [], providers: [] };
        };
      if (
        [
          "listPlans",
          "listScheduleLines",
          "listIntents",
          "listPaymentRecords",
          "listRefundIntents",
          "listCustomerCredits",
          "listAllocations",
        ].includes(String(property))
      ) {
        return async () => {
          paymentWorkspaceReads += 1;
          return [];
        };
      }
      if (property === "recordManualPayment")
        return async () => ({ payment: { id: "payment-test" } });
      if (property === "getPaymentRecordDetail")
        return async () => ({ paymentRecord: { id: "payment-test" } });
      return async () => ({});
    },
  },
) as PaymentApiPort;
const paymentSlice = createPaymentVerticalSlice(fakePaymentApi);
await paymentSlice.workspace.load();
const readsAfterLoad = paymentWorkspaceReads;
await paymentSlice.recordManualPayment(
  {} as Parameters<PaymentApiPort["recordManualPayment"]>[0],
);
assert.ok(
  paymentWorkspaceReads > readsAfterLoad,
  "A canonical payment mutation must refresh the authoritative workspace resource.",
);

await initializeApplicationComposition({ mode: "demo" });
assert.ok(
  getPaymentApplicationServices().verticalSlice,
  "Payments composition must expose the canonical vertical slice.",
);
assert.ok(
  getInvoiceApplicationServices().verticalSlice,
  "Invoices composition must expose the canonical vertical slice.",
);
await getPaymentApplicationServices().verticalSlice.workspace.load();
await getInvoiceApplicationServices().verticalSlice.workspace.load();
await getInvoiceApplicationServices().verticalSlice.receivables.load();

const localStorageViolations = [
  ...walkAllFiles(path.join(root, "src/modules/payments")),
  ...walkAllFiles(path.join(root, "src/modules/invoices")),
]
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter(
    (file) =>
      path.relative(root, file).replaceAll(path.sep, "/") !==
      "src/modules/invoices/runtime/receivableOperationsStore.ts",
  )
  .filter((file) =>
    /\b(?:localStorage|sessionStorage)\b/.test(fs.readFileSync(file, "utf8")),
  )
  .map((file) => path.relative(root, file).replaceAll(path.sep, "/"));

assert.deepEqual(
  localStorageViolations,
  [],
  `Canonical financial state must not use browser storage: ${localStorageViolations.join(", ")}`,
);

const invoiceSliceSource = fs.readFileSync(
  path.join(
    root,
    "src/modules/invoices/application/vertical-slice/invoiceVerticalSlice.ts",
  ),
  "utf8",
);
assert.match(
  invoiceSliceSource,
  /saveDraft:\s*\(input, signal\)\s*=>\s*mutate\(\(\)\s*=>\s*api\.saveDraft\(input, signal\), input\.invoiceId\)/,
  "Invoice draft save must preserve the versioned command input.",
);
assert.match(
  invoiceSliceSource,
  /idempotencyKey/,
  "Receivable allocation must carry an idempotency key.",
);
const invoiceHttpSource = fs.readFileSync(
  path.join(
    root,
    "src/modules/invoices/infrastructure/http/InvoiceHttpAdapter.ts",
  ),
  "utf8",
);
assert.match(
  invoiceHttpSource,
  /const \{ invoiceId, expectedVersion, idempotencyKey, \.\.\.body \} = input/,
  "Draft saves must separate transport concurrency metadata from the request body.",
);
assert.match(
  invoiceHttpSource,
  /idempotencyKey,\s*expectedVersion,\s*retry: "idempotent"/,
  "Draft saves must forward idempotency and expected-version transport metadata.",
);

console.log(
  "Financial vertical-slice contracts: PASS (authoritative queries, canonical mutations, refresh/cancel/conflict behavior, no financial browser authority)",
);
