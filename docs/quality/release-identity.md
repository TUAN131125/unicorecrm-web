# Release Identity

- Release: `unicorecrm-web@0.24.0-contract.0`
- Date: `2026-10-08`
- Status: `QUALITY_BASELINE_REMEDIATION_CANDIDATE`
- Scope: `CONTACT_SERVER_PAGING_LEAD_KANBAN_AND_SAVE_REMEDIATION`
- Classification: production-hardening candidate with bounded authorized Contact paging and summary, Tasks-owned follow-up projection, independent Lead Kanban windows, reconciled Contact command authority and validated awaited Save outcomes. Activity security authority remains unresolved and its fail-closed policy is preserved. Verification evidence is recorded separately; this identity does not attest deployment or unrestricted production acceptance.
- Backend target: ASP.NET Core/SQL Server backend.
- This is not an accepted production baseline.

Semantic authority order:

1. This release identity establishes version and scope.
2. `docs/api/openapi.json` owns operation-level HTTP status, path, DTO and transport policy.
3. Closed decision JSON and transaction contracts own business semantics.
4. Generated clients, catalogs and registries are deterministic derivatives.
5. Markdown summaries and README files are guidance only when a higher authority exists.
