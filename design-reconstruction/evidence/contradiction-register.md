# Contradiction register

Status: NON_AUTHORITATIVE.

| ID | Evidence A | Evidence B | Resolution |
|---|---|---|---|
| CON-001 | Stored inventory: 1,951 files and passing profile claim | Current source/reconstruction census; repo:check result | Record HIGH drift; preserve docs unchanged and report exact rerun result. |
| CON-002 | Shared/OpenAPI Money uses decimal strings with `HALF_UP` rounding | Legacy Product/Deal/Quote/Order fields use numbers | ProductDocument declares numeric frontend money fields display-only/non-authoritative. This is not a canonical contradiction; per-currency minor units remain separate non-blocking design debt. |
| CON-003 | Generic Quote acceptance/Lead qualification appear as operations | Typed replacements define accepted semantics | Generic operations remain blocked/retired; typed ready operations win. |
| CON-004 | Demo repositories can synchronously mutate snapshots | Connected mutations require MutationOutcome/backend evidence | Demo behavior is low authority and cannot define production success. |
| CON-005 | Reconstruction output must be outside docs and docs/document-status.json must remain unchanged | backend-readiness gate requires every repository Markdown file in docs/document-status.json | Record HIGH governance conflict; do not bypass either rule. |
| CON-006 | api-operation-catalog owners workspaces/studio for replaceWorkspaceCurrencies/putWorkspaceExchangeRate | OpenAPI x-module-owner platform/workspace-config | OpenAPI wins; canonical catalogs/owner coverage use platform/workspace-config; governed derivative remains a recorded drift. |
| CON-007 | workflow-ownership WF-12 says BLOCKED | OpenAPI completeOrderFromFulfillmentEvidence is PRODUCTION_CONTRACT_READY | OpenAPI controls HTTP transport; workflow registry readiness needs owner reconciliation. |
