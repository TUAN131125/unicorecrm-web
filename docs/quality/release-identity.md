# Release Identity

- Release: `unicorecrm-web@0.23.20-contract.0`
- Date: `2026-07-26`
- Status: `QUALITY_BASELINE_REMEDIATION_CANDIDATE`
- Scope: `FRONTEND_QUALITY_AND_RUNTIME_REMEDIATION`
- Classification: frontend quality and runtime remediation candidate with a green local baseline, corrected Orders query projection, authoritative demo access bootstrap, route/runtime cleanup and unchanged operation-level backend semantics.
- Backend target: ASP.NET Core/SQL Server backend.
- This is not an accepted production baseline.

Semantic authority order:

1. This release identity establishes version and scope.
2. `docs/api/openapi.json` owns operation-level HTTP status, path, DTO and transport policy.
3. Closed decision JSON and transaction contracts own business semantics.
4. Generated clients, catalogs and registries are deterministic derivatives.
5. Markdown summaries and README files are guidance only when a higher authority exists.
