# Financial Operations API Boundary

Phase 17 establishes the production API boundary for Invoices, Receivables and Payments.

## Ownership

- `InvoiceHttpAdapter` owns all ready Invoice commands and Invoice read models.
- `ReceivablesHttpAdapter` owns receivable list, summary, aging and buyer account-statement projections.
- `PaymentHttpAdapter` owns Payment Plans, Intents, Records, allocations, reconciliation, COD evidence, refunds and provider recovery.
- Generated clients are infrastructure-only. Presentation and application code use module ports and vertical slices.

## Financial authority

- Money is transported as decimal strings.
- Invoice totals, tax, discount, rounding, document numbers and creditable balances are backend-owned.
- Receivable outstanding and aging values are as-of backend projections.
- Payment records, allocations, reversals, customer credits, reconciliation and refunds are ledger operations owned by backend transactions.
- The frontend never manufactures settlement, issue, delivery, provider or refund evidence in connected mode.

## Mutation policy

- Ready financial commands require idempotency.
- Existing mutable aggregates require `If-Match`.
- Batch and ledger operations are atomic at the declared transaction boundary.
- Responses return authoritative documents, versions, command outcome and immutable evidence identifiers.
- Same idempotency key with a different payload is rejected.

## Compatibility

The legacy `allocatePayment` and `allocateCustomerCredit` operations remain blocked. `allocatePaymentSource` is the canonical closed allocation contract for both source types.

## Production acceptance

This boundary is ready for backend implementation at contract/adapter level. It does not prove durable storage, provider execution, browser E2E, live authorization or persistence-restart behavior.
