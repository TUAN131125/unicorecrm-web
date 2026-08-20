# Frontend conformance report

Status: NON_AUTHORITATIVE REVIEW.

This report distinguishes verified source/registry coverage from behavior not exercised in a browser. Inventory counts alone are not runtime conformance proof.

| Axis | Status | Traceable evidence | Result/limit |
|---|---|---|---|
| Registered routes and shell paths | VERIFIED | `src/platform/navigation/routeKeys.ts`; `docs/quality/repository-inventory.json`; `canonical-design/04-product-spaces-routes-capabilities.md` | 78/78 route keys and 62/62 loadable modules are represented structurally. |
| Route/product-space guards | PARTIAL | `src/app/router/workspaces`; `src/platform/access-control`; route quality inventory | Capability/workspace guard sources are classified, but no browser navigation matrix was executed. |
| Screen actions and mutation authority | PARTIAL | 173-row command registry; module/workflow docs; `MutationOutcome` boundaries | Command/transport availability is mapped; every rendered action was not exercised. |
| Forms and validation | PARTIAL | module domain/application packets; protected presentation sources in coverage ledger | Backend-significant invariants are documented; presentation-only field/layout behavior is not asserted as complete. |
| Lists/search/filter/sort/page | PARTIAL | 162-row query catalog; OpenAPI list operations; server-list architecture sources | Query authority is classified; UI controls and cursor behavior were not browser-tested per route. |
| Empty/loading/error states | NOT_VERIFIED | presentation/controller paths are classified only | These states are not promoted to backend semantics without route-level execution evidence. |
| Status/action visibility | PARTIAL | explicit six-module transition tables; capability catalog; effective access profiles | Domain legality and access inputs are documented; rendered visibility combinations were not exhaustively exercised. |
| Workspace switching/tenancy | VERIFIED | canonical route registry; WorkspaceBootstrapContext; listMyWorkspaces/getWorkspaceBootstrap | Source/contract require active membership and fail-closed cross-workspace access. |
| Auth/session states | VERIFIED | `auth.types.ts`; 10 identity-auth OpenAPI operations; canonical docs 05/platform owner | Enumerations, typed flows and token/credential boundary are explicit. |
| Role/capability/record/field access | VERIFIED | `evaluateEffectiveAccess.ts`; `accessGovernance.types.ts`; record-ownership rules; 13 access operations | Combination/default/ownership rules are now explicit; live backend decisions remain external conformance work. |
| Dashboards/composed read models | PARTIAL | query registry classifications; workspace read-model sources | 66 COMPOSED_READ_MODEL and 1 BFF_CANDIDATE are enumerated without invented endpoints; rendered totals were not tested. |
| Import/export | PARTIAL | command/query registries and OpenAPI operation catalog | Declared operations are mapped; file/download browser behavior was not executed. |
| Payment/shipping/returns/provider states | PARTIAL | owner/workflow docs; OpenAPI transaction metadata; provider contract sources | Semantic/transport boundaries are explicit; live provider conformance remains NOT_VERIFIED. |
| Studio configuration | PARTIAL | 14 workspaces/studio operations; StudioCore/QuickSetup source; platform owner docs | Draft/publish/Quick Setup semantics are documented; screens were not browser-tested. |
| People & Access | PARTIAL | 13 platform/access-control operations; access sources; owner doc | Member/invitation/role flows are documented; screens were not browser-tested. |
| Blocked/local/demo behavior | CONFLICT | 34 blocked OpenAPI rows; 17 blocked commands; browser demo adapters | Demo mutation success cannot establish connected production success. |
| Financial number compatibility | CONFLICT | shared/OpenAPI Money vs Product/Deal/Quote/Order number fields | Decimal-string transport remains canonical; migration/rounding decision remains open. |

No browser E2E or live provider conformance ran, so this report claims neither.
