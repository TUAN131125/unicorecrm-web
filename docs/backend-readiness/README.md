# Backend Readiness Contract Authority

OpenAPI `docs/api/openapi.json` is the sole production HTTP authority for `0.23.20-contract.0`.

- Commands: **173** (**152 ready, 17 blocked, 4 deprecated**).
- Queries: **162** (**0 unresolved**; 63 production API, 66 composed read model, 27 frontend-local, 5 demo-only, 1 BFF candidate).
- OpenAPI operations: **276** (**245 ready, 31 blocked**).
- Error codes: **210**.
- Workflow contract registry: **27 entries**; source inventory: **22 cross-module workflow directories**.
- Provider contract packs: **26**, containing **516 scenarios**.
- Quality gates: **310** across **11 groups**.

Phase 18 establishes dedicated Shipping and Returns API boundaries for booking, provider selection, tracking, delivery and COD evidence, plus Return eligibility, approval, receipt, inspection and resolution. Cross-module Order-to-Shipping, Shipping-to-Payment, Return-to-Inventory and Return-to-Refund transitions remain backend-owned transactions or sagas. Live durable backend/provider conformance remains an explicit external blocker.

Authority order is release identity → OpenAPI operation → closed decision/transaction contract → generated artifact → Markdown summary. `unresolved-decisions.json` contains only current blocked OpenAPI operations; it does not override a production-ready operation.
