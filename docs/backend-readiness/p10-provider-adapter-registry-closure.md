# P0.10 Provider Adapter and Query Registry Closure

Contract version: `0.23.20-contract.0`. Input SHA-256: `63fe5ce18d96c2718e3326629607157d9325e678aeba4c66f583c4eb8b86b147`.

## Closed decisions

### DEC-P10-APPLICATION-DTO-ADAPTERS — CLOSED

Lead, Product, Shipping Booking and Return list/detail operations are mapped through explicit infrastructure adapters into frontend application models. Raw generated OpenAPI DTOs are never exposed directly to presentation or generic application queries. Decimal-string Money and authoritative resourceVersion are preserved; any numeric conversion is display-only.

Owner: `frontend-architecture+api-contract-architecture`.

### DEC-P10-QUERY-REGISTRY-CLOSURE — CLOSED

All 141 query symbols have an explicit classification. Commercial-evidence and payment obligation queries are composed read models; lead duplicate helpers and selected calculations are frontend-local; five legacy number-based payment projections are demo-only. No query remains UNRESOLVED and no generic endpoint was invented.

Owner: `module-domain-owners+read-model-architecture`.

### DEC-P10-PROCESS-ISOLATED-REFERENCE-CONFORMANCE — CLOSED

The non-production reference provider host can run in a separate operating-system process and all provider scenarios target it over real HTTP using actual OpenAPI methods, paths and schemas. This proves process-boundary consumer/provider conformance only, not durable backend implementation.

Owner: `api-contract-architecture+quality`.

### DEC-P10-LIVE-DURABLE-PROVIDER-CONFORMANCE — BLOCKED_EXTERNAL

No durable backend URL, authenticated test identities, two isolated persisted workspaces, database transaction implementation or real external provider acknowledgement transport was supplied. Process-isolated reference conformance must not be represented as live backend acceptance.

Owner: `backend-provider-implementation+platform-security+ci-environment`.

### DEC-P10-DEPENDENCY-BACKED-VERIFICATION — BLOCKED_EXTERNAL

Full TypeScript, Vite production build and browser E2E require a clean dependency installation. Static syntax, import-resolution and deterministic contract gates do not replace those checks.

Owner: `ci-environment+frontend-platform`.

## Boundary statement

The process-isolated reference host is non-production contract evidence. Live durable provider execution, database semantics, authenticated workspace isolation and provider acknowledgement transport remain `BLOCKED_EXTERNAL`.
