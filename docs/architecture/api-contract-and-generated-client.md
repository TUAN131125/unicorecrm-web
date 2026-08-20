# API contract and generated client

## Authority

`docs/api/openapi.json` is the sole production HTTP contract authority. Only operations marked `PRODUCTION_CONTRACT_READY` are implementation contracts; `BLOCKED` operations are inventory placeholders with explicit decisions and no success response. Handwritten Markdown endpoint examples and module-local path literals are non-authoritative when they conflict with the specification.

Generated client ownership is declared in `scripts/api/openapi/client-ownership.json`. The generator rejects duplicate tag ownership, unowned operations, missing response schemas and generated-output drift.

## Boundary model

```text
OpenAPI 3.1
  -> load
  -> validate
  -> normalize ownership and policies
  -> render deterministic TypeScript clients and ledgers
  -> write/check
  -> module infrastructure adapter
  -> module application/domain contract
```

Generated transport DTOs are not domain entities. Presentation and application code do not import generated files directly. Module infrastructure adapters map generated responses into module-owned contracts.

## Shared conventions

- IDs are opaque strings with bounded length and conservative transport-safe characters.
- `X-Workspace-Id` is request routing context; tenant authority is server-side.
- Money is a decimal string plus uppercase ISO 4217 currency.
- UTC instants use RFC 3339 `date-time`; accounting dates use `full-date`.
- Collection pagination/filter/sort are operation-specific; no generic module list/detail convention is inferred.
- Errors use closed RFC 9457-style `application/problem+json` `ProblemDetails` with stable codes.
- Resource versions use `ETag`/`If-Match` at HTTP boundaries.
- Retriable mutations use `Idempotency-Key`; actor and authoritative time are never browser assertions.

## Deterministic generation

The thin CLI `scripts/api/generate-openapi-client.mjs` orchestrates focused owners under `scripts/api/openapi/`:

- `load.mjs` reads the specification and ownership manifest;
- `validate.mjs` validates OpenAPI and one-owner rules;
- `normalize.mjs` derives client, adapter, idempotency and concurrency metadata;
- `render.mjs` renders clients and machine-readable ledgers;
- `write-or-check.mjs` writes or byte-compares generated artifacts and scans endpoint authority;
- `operation-contract-status.json` is generated from OpenAPI so readiness/blocker classification cannot drift into a second authority;
- `breaking-changes.mjs` compares the reviewed compatibility baseline.

Generated outputs include 12 owned clients for Identity, Workspace Bootstrap, Access Governance, Receivables, Financial, Commercial and configuration boundaries, plus the platform index, checksum, generated-client manifest, operation coverage ledger and API operation catalog.

`npm run api:check` fails when:

- OpenAPI is invalid or an operation/tag is unowned;
- generated output or coverage metadata has drifted;
- a reviewed operation/schema contract is removed or narrowed;
- an internal Unicore endpoint literal is reintroduced outside generated clients;
- an external provider transport leaves its explicit allow-listed boundary.

## Connected financial adapters

`ReceivablesHttpAdapter`, `InvoiceHttpAdapter` and `PaymentHttpAdapter` call generated client methods only. Their previous handwritten Unicore paths are now represented by OpenAPI operations and generated methods. Carrier-provider paths remain external transport authority under the Shipping module and are explicitly documented in the ownership manifest.

The ledger records 236 production-ready operations and 34 blocked operations. Generated methods for blocked operations reject before network I/O. Generic module mutations remain registry-controlled, while dedicated module and workflow adapters own their declared operations. Current dedicated boundaries cover Identity, Workspace, Access, Lead, relationship domains, Deal, Quote, Product, Order, Finance, Shipping, Returns, Support, Tasks and Studio. This remains contract evidence, not provider implementation proof.

## Canonical platform ownership

Transport and generated contract code lives under `src/platform/api`. Module application/domain/presentation layers cannot import this boundary directly; module infrastructure adapters and the application composition root are the only business-facing consumers. `docs/architecture/module-api-boundary-template.md` defines the required module-owned ports, adapters, mappers and runtime composition.
