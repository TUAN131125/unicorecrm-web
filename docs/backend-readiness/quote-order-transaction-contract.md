# Quote and Order transaction contract

Contract version: `0.23.20-contract.0`.

## Quote acceptance

`acceptQuoteAndCloseDeal` accepts the targeted Quote and, when a linked Deal exists, closes that Deal as won in one backend transaction. It **does not create an Order**.

Order creation uses one of two distinct production-ready commands:

- `convertAcceptedQuoteToOrderDraft` creates exactly one DRAFT Order from an accepted Quote under a uniqueness lock and requires `If-Match`;
- `createOrderDraftCommand` creates a direct-sale DRAFT Order and DRAFT Payment Plan without a source Quote.

The generic `acceptQuote` operation remains intentionally blocked, and generic Quote status mutation remains deprecated.

## Standard Order confirmation

`confirmOrderWithPaymentPlan` confirms a DRAFT Order, activates the version-matched DRAFT Payment Plan, creates the payment instruction and closes the source Deal as won when required. The backend owns credit-policy evaluation. Inline frontend-authored approval evidence is rejected; the blocked variant is tracked by `DEC-P02-ORDER-CREDIT-APPROVAL-COMMAND`.

## Order cancellation

`cancelOrder` cancels the Order and an active Payment Plan in one transaction only when invoice, allocation, successful payment, active payment intent and shipping obligations do not require remediation. Those obligations are blockers, not frontend compensation steps. The former `order.cancel-with-compensation` command is deprecated.

All three operations require authentication, workspace enforcement, capability enforcement, `Idempotency-Key`, `If-Match`, immutable command audit and typed `application/problem+json` failures.

## Concurrency source boundary

The production commands require `If-Match`. Frontend workflow wrappers accept only caller-provided `expectedVersion`; they do not derive it from browser repositories or persisted demo snapshots. Until Quote and Order authoritative read projections expose a version token, connected presentation calls fail before network with a typed contract violation. This is an integration blocker, not permission to weaken concurrency.
