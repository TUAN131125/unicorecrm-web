# Independent review round 1 - implementer resolution

Status: NON_AUTHORITATIVE REVIEW EVIDENCE. Canonical status remains RECONSTRUCTED_DRAFT.

Every finding was reopened against the cited machine contract, registry or implementation source. No numbered Claude finding was rejected; several were narrowed by authority reconciliation.

| Finding | Verification evidence | Disposition |
|---|---|---|
| R1-BLOCK-01 | OpenAPI operations confirmOrderWithPaymentPlan, resolveReturnCreditRefund and getReturnCreditRefundResolution; workflow-ownership WF-13/WF-17 | CONFIRMED; RESOLVED in workflow documents with SINGLE_BACKEND_TRANSACTION/BACKEND_ORCHESTRATED_SAGA mapping. |
| R1-BLOCK-02 | OpenAPI operationId set; workflow ownership registry; source exported symbols | CONFIRMED; RESOLVED. Traceability contains only real operationIds and explicitly classified no-transport boundaries. |
| R1-BLOCK-03 | workflow-ownership WF-23 through WF-27 and their ready OpenAPI operations | CONFIRMED; RESOLVED. Five workflow documents added and catalog/README/traceability updated to 27. |
| R1-BLOCK-04 | evaluateEffectiveAccess.ts, accessGovernance.types.ts, recordOwnership rules/types and effective profiles | CONFIRMED; RESOLVED in docs 05/06 and platform access owner document. |
| R1-BLOCK-05 | OpenAPI blocked set, command/query registries, unresolved-decisions and absence of live provider run | CONFIRMED; NOT DISCHARGED. The five pre-existing blockers remain explicit and continue to prevent baseline. |
| R1-HIGH-01 | six cited transition-table sources plus quote approval/return intent types | CONFIRMED; RESOLVED in state-machine catalog and six module documents. |
| R1-HIGH-02 | query-registry.json | CONFIRMED; RESOLVED. 162/162 rows enumerate classification, symbol, owner, source, exact operationIds and decision. |
| R1-HIGH-03 | 22 source workflow packets, workflow-ownership metadata and OpenAPI delivery metadata | CONFIRMED; RESOLVED. All 27 documents now have workflow-specific triggers, preconditions, sequences, outcomes and recovery. |
| R1-HIGH-04 | dealStages.ts and dealPipelineHealth.ts | CONFIRMED; RESOLVED. buyerRef is the invariant; next action/staleness are projections with 14/21-day thresholds. |
| R1-HIGH-05 | OpenAPI x-module-owner census | CONFIRMED; RESOLVED. Six owner documents cover 65/65 non-business operations. |
| R1-HIGH-06 | prior 15-line report vs frontend-conformance skill axes | CONFIRMED; RESOLVED. The report now uses VERIFIED/PARTIAL/NOT_VERIFIED/CONFLICT with source and runtime limits. |
| R1-HIGH-07/08 | Money sources; repository inventory/status gates | CONFIRMED; NOT DISCHARGED. Three pre-existing HIGH findings remain visible and prevent baseline. |
| M-01 | OpenAPI x-module-owner vs derived api-operation-catalog | CONFIRMED; RESOLVED in canonical catalogs/owner docs. OpenAPI owners platform/workspace-config are adopted; governed docs/api derivative is not edited. |
| M-02 | literal corruption census | CONFIRMED; RESOLVED in canonical output; semantic chains use ASCII arrows/explicit None labels. |
| M-03 | analysis-state total vs classification sum | CONFIRMED; RESOLVED by distinguishing source snapshot files from all classified repository files and using the latter for sourceFilesClassified. |
| M-04 | fixed HIGH count vs conflicts array | CONFIRMED; RESOLVED with dynamic counts. |
| M-05 | blanket ADOPT_WITH_CORRECTION labels | CONFIRMED; RESOLVED by removing the blanket correction claim and retaining source-first case review only. |
| M-06 | forensic gap/heuristic text in canonical traceability | CONFIRMED; RESOLVED with explicit blocked/event/internal classifications. |
| M-07 | OpenAPI credentials/audit/outbox/transaction extensions | CONFIRMED; RESOLVED in contract conventions and per-operation catalog columns. |
| M-08 | semantic-packet imports vs full runtime coupling | CONFIRMED; RESOLVED by narrowing module wording so it makes no full-module coupling claim. |
| M-09 | configurable Deal pipelines/stages | CONFIRMED; RESOLVED in Deal and state-machine documents. |
| M-10 | auth/session enum sources | CONFIRMED; RESOLVED in doc 05 and identity-auth owner document. |
| M-11 | output layout vs tooling folder | CONFIRMED; RESOLVED by retaining generator provenance under the prescribed design-reconstruction/source namespace. |

## Authority nuances

- OpenAPI is C1 authority and overrides stale derived owner fields and the stale WF-12 registry readiness field for HTTP transport. The conflict remains visible rather than silently rewriting governed docs/.
- PRODUCTION_CONTRACT_READY internal/event workflows without a dedicated frontend endpoint are documented as backend event/internal boundaries, not frontend-local/demo and not fabricated HTTP operations.
- No baseline, backend or docs/ modification was produced.
