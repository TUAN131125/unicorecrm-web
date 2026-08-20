# ADR-004: Concurrency, versions and idempotency

> **Status:** ACCEPTED FOR BACKEND DESIGN  
> **Date:** 2026-07-17  
> **Decision scope:** Commands and mutable resources

## Context

The frontend command authority already carries expected-version and idempotency metadata, but terminology across legacy models includes both version and revision. Backend contracts need one optimistic-concurrency rule.

## Decision

1. Every mutable aggregate exposes a monotonically increasing integer `version`.
2. Commands that depend on current state carry `expectedVersion`. The backend performs compare-and-swap in the same transaction as the mutation.
3. HTTP resources expose the aggregate version through an ETag. Mutating REST-style endpoints use `If-Match`; command endpoints map their typed `expectedVersion` to the same rule.
4. A mismatch returns a typed `409 CONFLICT` with the current version and safe refresh guidance; the backend never performs silent last-write-wins updates.
5. Every externally retried mutation requires an idempotency key scoped by workspace, authenticated principal, command type and intended aggregate. Reusing a key with a different payload is rejected.
6. Idempotency outcomes are stored durably for a defined retention window and include success or terminal business rejection.
7. `revision` is reserved for immutable configuration/content revision histories. It must not be used as a synonym for mutable aggregate concurrency version.
8. Provider webhooks use provider event identity plus workspace/provider scope for inbox deduplication.

## Consequences

- The OpenAPI contract defines `ResourceVersion`, ETag and Idempotency-Key conventions; generated clients must preserve those boundaries as mutable operations are added.
- UI conflict handling refreshes authoritative state and asks the user to reapply intent where necessary.
- Background workers and workflow retries use the same idempotency contract as browser commands.

## Verification evidence

- `src/shared/application/`
- `src/platform/api/client/FetchHttpClient.ts`
- `src/platform/api/runtime/HttpMutationAuthority.ts`
- `npm run quality:gate -- --gate quality.mutation-command-authority`
- `npm run quality:gate -- --gate quality.integration-resilience`
- `npm run quality:gate -- --gate quality.contract-baseline`
