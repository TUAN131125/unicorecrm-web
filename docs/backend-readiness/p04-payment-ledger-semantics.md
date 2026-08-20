# P0.4 Payment ledger semantics

Contract version: `0.23.20-contract.0`. Input source SHA-256: `7e2795b78a992488b626a45300d652c5f8f521e322e20f20e1ca701f154c5e27`.

## Closed decisions

### `DEC-P04-PAYMENT-ALLOCATION-LEDGER`
One Payment Record or Customer Credit is allocated to one or more Invoice receivables in a single backend ledger transaction. Backend owns buyer/currency/outstanding/residual checks, allocation IDs, time, audit and events.
Operations: `allocatePaymentSource`.
Evidence: src/modules/payments/application/commands/paymentAllocationCommands.ts:allocatePaymentToInvoices, docs/business/payment-plans-and-collections-frontend-spec.md.

### `DEC-P04-PAYMENT-ALLOCATION-REVERSAL`
Reversal is an immutable ledger command over one effective allocation; backend restores source residual and emits reversal evidence.
Operations: `reversePaymentAllocation`.
Evidence: src/modules/payments/application/commands/paymentAllocationCommands.ts:reverseInvoiceAllocation.

### `DEC-P04-REFUND-ASYNC-INTENT`
Public API creates an asynchronous Refund Intent only. Provider execution and SUCCEEDED/FAILED completion, refund Payment Record and timestamps are backend-owned.
Operations: `createRefundIntent`, `getRefund`, `listRefunds`.
Evidence: src/modules/payments/application/commands/paymentRefundCommands.ts:createRefundIntent, src/modules/payments/application/commands/paymentRefundCommands.ts:completeRefundIntent.

### `DEC-P04-COD-COLLECTION-EVIDENCE`
Customer collection evidence is distinct from merchant remittance and never makes COD effective for receivables.
Operations: `recordCodCustomerCollection`.
Evidence: src/modules/payments/application/commands/paymentCodCommands.ts:recordCodCustomerCollectionEvidence.

### `DEC-P04-COD-REMITTANCE-EVIDENCE`
Merchant remittance requires customer collection; only REMITTED makes the COD Payment effective for receivables.
Operations: `recordCodMerchantRemittance`.
Evidence: src/modules/payments/application/commands/paymentCodCommands.ts:recordCodMerchantRemittanceEvidence, src/workflows/shipping-cod-evidence/index.ts.

## Remaining blockers

### `DEC-P04-RETURN-REFUND-SAGA`
How does Return approval release allocations, create credits/refund intents and settle Invoice/Receivable state atomically or as a saga?
Owner: returns+payments+invoices. Blocking operations: resolveReturnCreditRefund. Reason: Cross-module compensation, retry and partial-failure semantics remain incomplete.

### `DEC-P04-REFUND-CANCEL-RETRY`
When may a failed/processing refund be cancelled or retried and how is provider idempotency retained?
Owner: payments. Blocking operations: none yet assigned. Reason: Frontend only proves creation and backend completion/failure primitives.

## Authority boundaries
Connected mode sends business intent only. Backend owns ledger IDs, buyer/currency validation, outstanding and residual amounts, lifecycle completion, timestamps, actor/audit evidence, provider evidence linkage, resource versions and emitted events. Demo/local projections remain explicitly labeled and cannot be imported by connected production adapters.
