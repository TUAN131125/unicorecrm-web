# Payment financial-effects decisions

Contract version: `0.23.20-contract.0`.

## Production-contract-ready

- `reconcilePaymentRecord`: versioned single-record reconciliation.
- `allocatePaymentSource`: one Payment Record or Customer Credit allocated to one or more Invoice receivables in one backend ledger transaction.
- `reversePaymentAllocation`: immutable reversal with required reason and restored source residual.
- `createRefundIntent`: asynchronous `202` Refund Intent creation; provider execution is backend-owned.
- `recordCodCustomerCollection`: customer collection evidence only; never settles receivables.
- `recordCodMerchantRemittance`: merchant remittance evidence; only `REMITTED` becomes effective for receivables.

## Remaining constraints

- Generic `allocatePayment` and `allocateCustomerCredit` remain blocked; `allocatePaymentSource` is the typed allocation command.
- Database precision/scale, document-level tax semantics and allocation residual policy remain unresolved in `money-contract.json`.
- `resolveReturnCreditRefund` is a typed backend-owned saga, but its Customer Credit variant must fail closed until the residual-allocation policy is approved.

The former Return refund saga, refund cancellation/retry, Payment Plan/Intent Money projection, credit approval and accepted Quote-to-Order blockers were closed by the later P0.5–P0.8 decision packs. Connected mode must follow the current operation-level OpenAPI status and must not resurrect those historical blockers.
