# ADR-002: Workspace tenancy and isolation

> **Status:** ACCEPTED FOR BACKEND DESIGN  
> **Date:** 2026-07-17  
> **Decision scope:** Shared backend foundation

## Context

Frontend routes are workspace-scoped and the shared HTTP client sends `X-Workspace-Id`. Browser storage currently scopes demo snapshots by workspace, but production tenant isolation must be enforced by the backend and database.

## Decision

1. A Workspace is the primary tenant boundary for CRM business data.
2. Canonical browser routes may use a human-readable `workspaceKey`; backend persistence and authorization use an immutable `workspaceId`.
3. `X-Workspace-Id` expresses the requested workspace context. The backend validates that it matches an active membership for the authenticated subject; the header itself is never trusted as proof of access.
4. Every tenant-owned table, aggregate, audit record, outbox message, idempotency record and provider-inbox record carries `workspace_id` or an equivalent enforced partition key.
5. All unique constraints for tenant-owned business identifiers include workspace scope unless the identifier is intentionally global.
6. Repository/query APIs require workspace context. Cross-workspace reads and writes are denied by default and tested explicitly.
7. Background jobs preserve workspace context in durable job/outbox metadata and re-authorize system operations according to a declared service principal.
8. The target backend uses a modular monolith and SQL Server. Database security policies may be added as defense in depth, but application predicates and authorization remain mandatory.

## Consequences

- No API may infer workspace solely from a record identifier supplied by the client.
- Cache keys, object storage paths, search indexes and telemetry dimensions must include workspace scope.
- Data export, restore, anonymization and retention operations must remain workspace-bounded.

## Verification evidence

- `src/platform/navigation/canonicalRoutes.ts`
- `src/platform/api/client/FetchHttpClient.ts`
- `src/platform/workspace-scope/`
- `npm run quality:gate -- --gate quality.workspace-isolation-contracts`
- `npm run quality:gate -- --gate quality.customer-relationship-integrity`
- `npm run quality:gate -- --gate quality.contract-baseline`
