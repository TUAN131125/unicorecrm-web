# ADR-005: Workflow transactions, process managers and events

> **Status:** ACCEPTED FOR BACKEND DESIGN  
> **Date:** 2026-07-17  
> **Decision scope:** Cross-module business workflows

## Context

The frontend models 22 cross-module workflow directories. Demo handlers can snapshot and roll back browser repositories, but production correctness requires durable transaction ownership and reliable external side effects.

## Decision

1. Backend implementation starts as a modular monolith with explicit module ownership and application workflows. Frontend module count does not imply one microservice per module.
2. A single-aggregate mutation is handled by the owning module in one database transaction.
3. A synchronous cross-module invariant inside the modular monolith is coordinated by an application workflow and may use one database transaction while preserving module repository boundaries.
4. Long-running, externally observable or provider-dependent flows use a durable process manager/saga with explicit states, retries, compensation and operator recovery.
5. Domain/integration events are written through a transactional outbox in the same transaction as authoritative state. Consumers are idempotent.
6. Provider callbacks enter through a durable webhook inbox with signature validation, deduplication, workspace/provider resolution and replay evidence.
7. Browser code never owns production rollback, audit, outbox publication or final workflow success. UI success is shown only after authoritative command outcome or refreshed query evidence.
8. Direct cross-module repository access remains prohibited; workflows consume module application/public boundaries.

## Workflow classification rule

| Situation | Mechanism |
|---|---|
| One aggregate, no external dependency | Owning-module transaction |
| Multiple modules, immediate invariant, same backend/database | Application workflow transaction |
| External provider or delayed human step | Durable process manager/saga |
| Notification, search, analytics or downstream projection | Outbox event and idempotent consumer |
| Provider callback | Webhook inbox and state-machine command |

## Consequences

- Order confirmation/closing, quote acceptance and lead qualification need explicit transaction ownership.
- Shipping, returns/refunds, reconciliation and notifications need durable state machines and retry evidence.
- Full backend E2E must assert outbox/inbox replay and idempotency, not only frontend state transitions.

## Verification evidence

- `src/workflows/`
- `docs/architecture/module-ownership-and-workflows.md`
- `src/shared/application/MutationAuthorityPort.ts`
- `npm run quality:gate -- --gate quality.mutation-command-authority`
- `npm run quality:gate -- --gate quality.commercial-flow-regressions`
- `npm run quality:gate -- --gate quality.contract-baseline`
