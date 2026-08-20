# P0.7 Order, Support, Tasks and Refund Recovery Decisions

Contract version: `0.23.20-contract.0`.

## Closed

- Direct-sale Order draft is one backend Order + Payment Plan transaction.
- Support Case create, assign, lifecycle transition, reply and internal-note contracts are typed and server-authoritative.
- Task create, complete, cancel, assign, reschedule, archive and activity-log contracts are typed and server-authoritative.
- Support/Task list and detail projections expose `resourceVersion`.

## Refund recovery

At the P0.7 checkpoint, refund cancellation and retry were blocked because provider-attempt identity and acknowledgement semantics were missing. P0.8 subsequently closed those decisions with `listRefundProviderAttempts`, `requestRefundCancellation` and `retryRefundIntent`.

## Explicitly retained blockers

- Generic `support.update` aggregate patch.
- Live provider/backend execution.

The generic terminal `cancelRefundIntent` operation remains absent by design; cancellation is an asynchronous request, not an immediate terminal mutation.
