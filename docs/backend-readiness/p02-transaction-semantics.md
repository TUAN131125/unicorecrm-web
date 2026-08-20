# P0.2 transaction semantics

Contract version: `0.23.20-contract.0`. Input SHA-256: `366d10d194371629de89cb9bf550b47c0d5b96a66ec27eaee0843b918002c1d0`.

P0.2 closes only transaction semantics supported by executable source and prior contract evidence. It does not infer credit approval, allocation, refund or COD behavior.

## `acceptQuoteAndCloseDeal`

- Command: `quote.accept-and-close-deal`
- Boundary: `SINGLE_BACKEND_TRANSACTION`
- Authoritative effects: QUOTE_ACCEPTED, LINKED_DEAL_WON_IF_PRESENT
- Explicit non-effects: ORDER_NOT_CREATED

## `confirmOrderWithPaymentPlan`

- Command: `order.confirm-with-payment-plan`
- Boundary: `SINGLE_BACKEND_TRANSACTION`
- Authoritative effects: ORDER_CONFIRMED, PAYMENT_PLAN_ACTIVATED, PAYMENT_INSTRUCTION_CREATED, SOURCE_DEAL_WON_IF_NEEDED
- Blocked variant: `INLINE_CREDIT_APPROVAL`

## `cancelOrder`

- Command: `order.cancel`
- Boundary: `SINGLE_BACKEND_TRANSACTION`
- Authoritative effects: ORDER_CANCELLED, ACTIVE_PAYMENT_PLAN_CANCELLED_IF_PRESENT
- External obligations: `BLOCKERS_NOT_COMPENSATIONS`

## `reconcilePaymentRecord`

- Command: `payment.reconcile-record`
- Boundary: `SINGLE_AGGREGATE_TRANSACTION`
- Authoritative effects: RECONCILIATION_STATE_RECORDED, AUDIT_RECORDED

## Connected concurrency projection

- `If-Match` must come from caller-supplied authoritative read-model metadata.
- Quote, Order and Deal browser snapshots are not valid production concurrency authorities.
- Primary aggregate version is returned once in the mutation outcome envelope; duplicate primary versions were removed from domain result DTOs.
- Secondary Deal versions are omitted until a typed authoritative Deal projection is approved.
- At the P0.2 checkpoint, connected Quote/Order UI remained fail-closed pending authoritative read versions. P0.3 closed that read-model decision; current Quote and Order detail projections expose `resourceVersion`.

## Remaining blockers

- `DEC-P02-PAYMENT-ALLOCATION`
- `DEC-P02-REFUND-ASYNC-LIFECYCLE`
- `DEC-P02-COD-SETTLEMENT`
- `DEC-P02-ORDER-CREDIT-APPROVAL-COMMAND`
