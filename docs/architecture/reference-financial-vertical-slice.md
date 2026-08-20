# Reference financial vertical slice

## Purpose

Payments, Invoices and Receivables remain the deepest reference implementation for moving a browser-backed module to an authoritative application/API boundary. Lead, Deal, Quote and Order now reuse the same resource state model for commercial list/detail queries while retaining transitional module read caches for existing presentation consumers.

The vertical slice proves this dependency flow:

```text
presentation query/mutation hooks
  -> module public application facade
  -> typed vertical-slice query/command ports
  -> generated OpenAPI client for declared Receivables operations
  -> demo-memory or HTTP adapters selected by composition
  -> shared HTTP client in connected mode
```

Presentation must not read or mutate the Payment or Invoice browser repository directly.

## Authoritative resources

`src/shared/application/authoritativeResource.ts` owns reusable query state:

- `IDLE`, `LOADING`, `READY` and `ERROR` states;
- stable data during background refresh;
- request cancellation through `AbortController`;
- explicit retry/refresh;
- stale-request suppression;
- subscription through `useSyncExternalStore`.

Module resources are owned by:

```text
src/modules/payments/application/vertical-slice/paymentVerticalSlice.ts
src/modules/invoices/application/vertical-slice/invoiceVerticalSlice.ts
```

The Payment slice exposes workspace and payment-detail resources. The Invoice slice exposes invoice workspace, invoice detail, receivables workspace, receivable detail and account-statement resources.

## Canonical mutations

Financial presentation calls only canonical operations exported by module public boundaries. Examples include:

- `recordManualPaymentCanonical`;
- `createPaymentIntentCanonical`;
- `reversePaymentAllocationCanonical`;
- `createInvoiceDraftCanonical`;
- `saveInvoiceDraftCanonical`;
- `issueInvoiceCanonical`;
- `createCreditNoteCanonical`;
- `allocateReceivableCanonical`.

A successful mutation refreshes the affected authoritative resources before it resolves to presentation. The UI does not treat a local optimistic repository write as server success.

Invoice updates carry an explicit expected version. Idempotent create/send/allocation operations carry stable idempotency keys. HTTP `409` responses map to `CONFLICTED`; the Invoice detail/form surfaces require the operator to refresh the authoritative version before retrying.

## Runtime modes

Demo mode binds the same vertical-slice ports to in-memory adapters. Connected mode binds Payment, Invoice and Receivables to HTTP adapters through the shared HTTP client. Receivables paths and transport DTOs are generated from OpenAPI and mapped by `ReceivablesHttpAdapter`. Presentation code is identical in both modes.

The modules do not store canonical financial state in `localStorage` or `sessionStorage`. The Receivables collection-activity store is an operational note seam, not the source of Invoice, Payment, Allocation, Credit Note or Receivable balances.

## Presentation coverage

The following surfaces now use authoritative queries:

- Payment Operations;
- Payment Detail;
- Invoice List;
- Invoice Form;
- Invoice Detail;
- Receivables List;
- Receivable Detail;
- Account Statement.

Loading, cancellation, error retry, post-mutation refresh and version-conflict recovery are visible presentation states.

## Verification

```bash
npm run quality:gate -- --gate quality.financial-vertical-slice
```

The gate rejects legacy financial repository/snapshot usage in presentation, checks canonical operation evidence, exercises resource load/refresh/cancel behavior, proves Payment mutation refresh, verifies composition ownership and rejects browser persistence for canonical financial state.

## Commercial query adoption

Lead, Deal, Quote and Order now own cursor-complete collection resources plus per-record detail resources under each module `application/vertical-slice` boundary. Connected presentation surfaces expose loading, cancellation, retry, background refresh and stale-data evidence. Server DTOs are projected into the existing module read caches so current filters and controllers can migrate without reimplementing domain mutations in React.

The query resources are workspace-scoped. A workspace change clears the module projection and resets the resource in a layout effect before the next workspace data is rendered, preventing cross-tenant stale snapshots.

```bash
npm run quality:gate -- --gate quality.commercial-authoritative-queries
```
