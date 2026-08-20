# API contract authority

The machine-readable [OpenAPI 3.1 contract](./openapi.json) is the sole production HTTP contract authority. An operation is implementable only when `x-contract-status` is `PRODUCTION_CONTRACT_READY`; `BLOCKED` operations deliberately advertise no success response.

Current generated coverage contains 270 operations: 236 production-ready and 34 explicitly blocked. Every operation has:

- one bounded-context owner;
- one generated client and generated method;
- explicit adapter status and test-gate coverage;
- explicit authorization, workspace/data scope, idempotency, concurrency, audit, event and transaction policy;
- either typed request/success schemas or an explicit blocking decision with no 2xx contract.

The frontend contract owns bearer authentication, workspace context, decimal-string money, UTC/business dates, stable errors, versions, idempotency and optimistic concurrency. Generated transport DTOs are not domain models; module infrastructure adapters map generated transport contracts into module-owned application contracts.

The generator pipeline is split into deterministic stages:

```text
load -> validate -> normalize -> render -> write/check
```

Authority files:

- `scripts/api/openapi/client-ownership.json` — generated client, tag and adapter ownership;
- `docs/api/generated-client-manifest.json` — generated output and operation/client mapping;
- `docs/api/operation-coverage-ledger.json` — operation ownership, adapter status and policy coverage;
- `docs/api/api-operation-catalog.json` — canonical generated query/command catalog for module ownership, DTOs, authorization and delivery policies;
- `docs/api/openapi-breaking-baseline.json` — reviewed compatibility baseline.

Run:

```bash
npm run api:generate
npm run api:check
```

A reviewed breaking-contract change requires an explicit baseline update:

```bash
node scripts/api/generate-openapi-client.mjs --accept-breaking-baseline
```

Do not use that flag to hide an unreviewed breaking change. Do not edit files under `src/platform/api/generated/` by hand.
