# Release Identity

- Release: `unicorecrm-web@0.24.0-contract.0`
- Date: `2026-07-26`
- Status: `QUALITY_BASELINE_REMEDIATION_CANDIDATE`
- Scope: `FRONTEND_QUALITY_AND_RUNTIME_REMEDIATION`
- Classification: quality and runtime remediation candidate. Verification evidence for individual changes is recorded separately; this identity does not attest deployment or production release approval. Activity security restrictions remain fail-closed.
- Backend target: ASP.NET Core/SQL Server backend.
- This is not an accepted production baseline.

Semantic authority order:

1. `docs/quality/release-identity.json` establishes version, date, status and scope; this Markdown summarizes that authority.
2. `docs/api/openapi.json` owns operation-level HTTP status, path, DTO and transport policy.
3. Closed decision JSON and transaction contracts own business semantics.
4. Generated clients, catalogs and registries are deterministic derivatives.
5. Markdown summaries and README files are guidance only when a higher authority exists.
