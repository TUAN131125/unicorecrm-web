# Backend Readiness Contract Authority

OpenAPI `docs/api/openapi.json` is the sole production HTTP authority for `0.24.0-contract.0`.

- Commands: **184** (**165 ready, 15 blocked, 4 deprecated**).
- Queries: **162** (**0 unresolved**; 63 production API, 66 composed read model, 27 frontend-local, 5 demo-only, 1 BFF candidate).
- OpenAPI operations: **303** (**275 ready, 28 blocked**).
- Error codes: **210**.
- Workflow contract registry: **27 entries**; source inventory: **22 cross-module workflow directories**.
- Provider contract packs: **26**, containing **516 scenarios**.
- Quality gates: **345** across **11 groups**.

Phase 18 establishes dedicated Shipping and Returns API boundaries for booking, provider selection, tracking, delivery and COD evidence, plus Return eligibility, approval, receipt, inspection and resolution. Cross-module Order-to-Shipping, Shipping-to-Payment, Return-to-Inventory and Return-to-Refund transitions remain backend-owned transactions or sagas. Live durable backend/provider conformance remains an explicit external blocker.

Authority order is release identity → OpenAPI operation → closed decision/transaction contract → generated artifact → Markdown summary. `unresolved-decisions.json` contains only current blocked OpenAPI operations; it does not override a production-ready operation.

Operation authorization, idempotency and concurrency rows are generated from all 303 canonical OpenAPI operations. `api:generate` refreshes these policy matrices; `api:check` rejects drift. Each authorization row requires explicit workspace and actor metadata, including the separate Contact summary and Lead Kanban reads.

`contract-inventory.json` retains the pinned P0.10 audit snapshot and its original input hash. Its historical version and counts are reference evidence; current operation counts come from the generated OpenAPI coverage ledger, and current file/gate counts come from the regenerated repository inventory.

The production-hardening candidate admits bounded Contact paging, filtered summary and Tasks-authorized follow-up, plus independent Lead Kanban windows. Contact create/update/archive and six relationship commands are READY; restore, anonymize and bulk operations remain independently blocked. Actual SQL and connected-browser verification cover these boundaries. Activity security remains an authority gap with its existing fail-closed policy preserved; Contact lastContacted, priority, teamContacts, inactiveLongTime and unadmitted duplicate/Deal projections remain unavailable. See [Contact query authority](../architecture/contact-server-query.md) for the exact admitted semantics and scale limits.
