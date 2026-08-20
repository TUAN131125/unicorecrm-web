# Shipping & Returns API boundary

Release: `unicorecrm-web@0.23.20-contract.0`

Decision: `DEC-PHASE18-SHIPPING-RETURNS-API-BOUNDARY` — **CLOSED**.

## Authority

`docs/api/openapi.json` owns production request, response, authorization, idempotency,
optimistic-concurrency and error semantics. Shipping and Returns expose typed application
runtimes with dedicated HTTP adapters. Browser repositories are read-model projections
only in connected mode.

Shipping provider credentials and provider-native errors never enter frontend DTOs.
The backend normalizes carrier failures and owns booking attempts, tracking, delivery and
COD evidence. Connected COD synchronization stops after the Shipping command; a backend
event handler owns the Payment projection.

Return creation, approval, rejection, receipt, inspection/resolution and closure return
authoritative records and mutation evidence. Order-to-Shipping, Return-to-Shipping,
Return-to-Inventory and Return-to-Refund transitions are backend transactions or sagas.
The frontend submits one typed intent and never rolls back cross-module snapshots in
connected mode.

## Runtime split

- `demo`: local commands and snapshot rollback are permitted and visibly non-production.
- `connected`: generated clients, dedicated adapters, authoritative refresh and no local
  workflow fallback.
- `test`: explicit injected runtimes only.

Provider conformance is defined by
`tests/fixtures/backend-contract/shipping-returns-core/provider-scenarios.json`. A live
backend and two workspace identities remain required to execute that pack.
