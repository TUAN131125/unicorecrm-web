# Invoice provider contract pack

Status: **SPECIFICATION_READY / EXECUTION_BLOCKED_UNTIL_BACKEND_EXISTS**  
Contract version: `0.14.0-contract.0`

## Supported vertical slice

The first backend implementation slice is intentionally limited to:

1. `createInvoiceDraft`
2. `saveInvoiceDraft`
3. `listInvoices`
4. `getInvoice`
5. `getInvoiceIssueReadiness`
6. `issueInvoice`

The backend owns aggregate IDs, line IDs, timestamps, versions, invoice numbers, calculated line amounts, document totals, audit evidence and emitted event IDs. The client owns only editable draft intent, request IDs and idempotency keys.

## Fixtures

Canonical request/response fixtures live under `tests/fixtures/backend-contract/invoice-draft/`. They are validated against `docs/api/openapi.json` by the deterministic quality pipeline.

## Provider execution

Run:

```bash
node tests/contract/provider/run-invoice-draft-provider-contract.mjs
```

Required environment variables are listed in `provider-scenarios.json`. Missing backend credentials or a missing backend endpoint is `BLOCKED_EXTERNAL`, never PASS.

## Acceptance boundaries

- Create returns HTTP 201, a server-assigned Invoice ID distinct from `creationIntentId`, version 1 or higher, calculated totals and immutable audit/event evidence.
- Same idempotency key and same payload returns the same command and aggregate with `REPLAYED`.
- Same key with a different payload returns 409 `IDEMPOTENCY_KEY_REUSED`.
- Save requires `If-Match`, changes only DRAFT-editable fields and recalculates totals.
- Stale save returns 412 `VERSION_CONFLICT` with aggregate and version details.
- Client-supplied totals or server-owned fields are rejected; they are never ignored silently.
- Cross-workspace read returns 403 `WORKSPACE_MISMATCH` under this contract.
- Issue returns `ISSUED`, an authoritative invoice number, a new version, audit evidence IDs and event IDs.
