# API contract verification

`npm run api:check` protects the OpenAPI 3.1 contract, deterministic generated frontend clients and compatibility baseline.

The gate verifies:

- OpenAPI 3.1 and JSON Schema 2020-12 declarations;
- release/package/OpenAPI version alignment;
- unique operation IDs and exactly one owner/client mapping per operation;
- 270/270 operation entries in the generated manifest and coverage ledger, split into 236 ready and 34 blocked;
- exact agreement between every blocked OpenAPI operation and the current decision ledger;
- exact agreement between operation error codes, the shared `ErrorCode` enum and the stable error catalog;
- closed Money and ProblemDetails contracts plus operation-specific authorization, workspace/data scope, concurrency and idempotency policies;
- byte-for-byte checksum, client, index, manifest and coverage-ledger output;
- generated-method presence for every operation, with blocked methods rejecting before network I/O;
- explicit adapter status and stable test-gate coverage;
- no handwritten internal endpoint authority; Invoice/Receivables typed boundaries and explicit blocking of unresolved Payment money projections;
- approved external provider transport boundaries;
- breaking-change detection for removed operations, required inputs and narrowed schemas;
- non-breaking allowance for new operations and optional schema properties;
- strict request/response fixture validation, unknown-enum rejection, ProblemDetails parsing, duplicate-execution, version-conflict and cross-workspace denial fixtures.

Generation remains repository-local and dependency-free. A normal generation run never rewrites the breaking baseline. Updating `docs/api/openapi-breaking-baseline.json` requires the explicit `--accept-breaking-baseline` review action.
