# Transaction provider contract pack

Contract version: `0.23.20-contract.0`.

The pack under `tests/fixtures/backend-contract/transaction-semantics/` defines twelve provider scenarios for:

- Quote acceptance and idempotent replay without Order creation.
- Stale Quote version conflict.
- Standard Order confirmation.
- Credit-approval-required failure.
- Order cancellation and blocker failure.
- Payment reconciliation.
- Cross-workspace denial.
- Idempotency conflict.

Runner: `tests/contract/provider/run-transaction-semantics-provider-contract.mjs`.

Static fixture/schema validation is deterministic. Real provider execution requires a backend base URL, two test workspaces, credentials and seeded aggregate IDs/versions; without them the runner exits as `BLOCKED_EXTERNAL` rather than reporting PASS.
