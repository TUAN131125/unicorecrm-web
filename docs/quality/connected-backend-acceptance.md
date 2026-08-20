# Connected Backend Acceptance

> **Status:** CURRENT  
> **Authority:** Patch 7 connected acceptance harness  
> **Scope:** Frontend-to-backend protocol, generated API contract, workspace isolation and connected browser evidence

## Evidence levels

### LOCAL FIXTURE

The repository contains a test-only HTTP host at `tests/fixtures/connected-host/connectedApiTestHost.mjs`. It verifies real HTTP transport, bearer and workspace headers, list/detail/create/update behavior, idempotency, optimistic concurrency, validation, retry and backend-owned audit evidence.

The fixture is **NOT production backend** code. It is not an ASP.NET Core host, does not use SQL Server and does not prove database persistence or restart durability.

Run the deterministic local integration gate:

```bash
npm run quality:gate -- --gate quality.connected-backend-integration
```

With Vite and Playwright installed, run the connected browser against the local fixture:

```bash
npm run e2e:connected
```

### EXTERNAL BACKEND

The generated-client acceptance gate requires a disposable real backend environment and dedicated test workspaces. Supply values at runtime; do not write tokens or customer identifiers into tracked files:

```bash
export UNICORECRM_TEST_API_BASE_URL='https://test-api.example.invalid'
export UNICORECRM_TEST_ACCESS_TOKEN='runtime-secret'
export UNICORECRM_TEST_WORKSPACE_ID='workspace-a'
export UNICORECRM_TEST_CUSTOMER_ID='customer-in-workspace-a'
export UNICORECRM_TEST_SECONDARY_ACCESS_TOKEN='runtime-secret-secondary'
export UNICORECRM_TEST_SECONDARY_WORKSPACE_ID='workspace-b'
npm run quality:gate -- --gate quality.real-backend-contract
```

The gate exercises generated OpenAPI clients, workspace isolation, validation, idempotency and optimistic concurrency. A successful read-after-write does **not** prove database restart durability; that remains a separate backend infrastructure test.

For browser acceptance against that environment:

```bash
npm run quality:gate -- --gate quality.connected-browser-e2e
```

The browser test uses the external backend for transport/auth evidence. Full UI DTO acceptance remains BLOCKED until the backend supplies the reviewed commercial projection contract expected by connected presentation services.

## Status rules

- `PASS`: the named gate actually executed and passed.
- `BLOCKED`: dependencies, backend endpoint, tokens, workspace fixtures or browser runtime are unavailable.
- `NOT RUN`: no execution was attempted.
- Local-fixture PASS must never be reported as production backend, SQL Server or durable database PASS.
- Browser E2E must never be claimed unless a real browser process completed the connected Playwright suite.
- Git-history and GitHub push-protection evidence remain separate because source archives do not contain `.git` metadata.
