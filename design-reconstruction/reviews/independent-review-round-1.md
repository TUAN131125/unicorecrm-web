# Independent review — round 1

Status: NON_AUTHORITATIVE REVIEW.
Role: independent reviewer (Codex is the implementer).
Mode: `baseline` review only. No baseline was created; `canonical-design/` and `docs/` were not modified.
Artifact under review: `canonical-design/` @ `unicorecrm-web@0.23.20-contract.0`, plus `design-reconstruction/`.

## Result

**NOT_READY_TO_BASELINE**

The reconstruction's *machine-derived* layers (contract catalog, command catalog, source coverage, route/capability inventory) are accurate and independently reproducible. The *reconstructed semantic* layers (workflows, state machines, business rules, access/ownership, queries) are not yet backend-implementable, and in four places the canonical design actively contradicts the adopted OpenAPI contract.

Codex's own `analysis-state.json` already declares 5 BLOCKER and 3 HIGH findings and withholds the baseline. That self-assessment is confirmed. This review adds findings Codex did not record.

---

## 1. Verified correct (independently reproduced)

These claims were re-derived from source/contract, not accepted from `canonical-design/`.

| Claim | Verification | Result |
|---|---|---|
| OpenAPI SHA-256 `8278547d…f402757`, version `0.23.20-contract.0` | `sha256sum docs/api/openapi.json` vs `docs/api/openapi.sha256` and `00-document-control.md` | MATCH |
| 270 operations / 236 ready / 34 blocked | parsed `docs/api/openapi.json`, counted `x-contract-status` | MATCH (270 unique operationIds, 240 paths) |
| `operation-catalog.md` completeness | diffed all 270 rows against OpenAPI on owner, transport, status, capability, idempotency, concurrency | 270/270 present; **2 owner mismatches** (see M-01); all other fields exact |
| `blocked-contracts.md` | 34/34 operationIds and decision IDs vs `x-blocking-decision-id` | MATCH (2 owner mismatches, same rows) |
| `11-use-case-catalog.md` | diffed all 173 rows against `docs/backend-readiness/command-registry.json` | 173/173 exact on command type, owner, status, operationId, decision |
| 173 commands (17 BLOCKED / 152 READY / 4 DEPRECATED) | recomputed from command registry | MATCH |
| 162 queries and classification split | recomputed from `docs/backend-readiness/query-registry.json` | MATCH (66/27/63/5/1) |
| Repository coverage 100% | expanded `git ls-files` + untracked into 2,064 paths and set-diffed against `source-coverage-ledger.json` | **0 files on disk missing from ledger, 0 ledger paths absent from disk**, 0 duplicates, classifications sum to 2,064 |
| 78 route keys | parsed `src/platform/navigation/routeKeys.ts` (78 entries) → inventory → `04-*.md` | MATCH, all 78 paths byte-identical |
| 123 capabilities | `docs/quality/repository-inventory.json` capability values vs doc 04 list | MATCH, zero set difference |
| 13 workspace flags + optionality | inventory `workspaceFlags` vs doc 04 (`?` markers) | MATCH |
| 15 modules / 22 `src/workflows` boundaries | directory census | MATCH |
| Money semantics | read `src/shared/money/money.ts` | Decimal-string + uppercase currency, scale alignment, mixed-currency rejection, display-only numbers — doc 13 accurate |
| Quote / Return / Deal lifecycle state sets | `quote.types.ts`, `return.types.ts`, `deal.types.ts` | State *sets* accurate (see H-01 for transitions) |
| Workspace bootstrap claims (doc 05) | `src/platform/workspace-context/domain/workspaceBootstrap.types.ts` | `contextVersion`, capability projection, runtime configuration confirmed |
| `npm run api:check` PASS | executed | PASS — 270/236/34, checksum verified |
| `npm run repo:check` FAIL | executed | FAIL — documentation count 279 vs stored 178 (reconstruction's own output) |
| `quality.backend-readiness` FAIL | executed | FAIL — reconstruction Markdown absent from `docs/document-status.json` |
| No baseline created | `canonical-design/BASELINE.json` absent; no `CANONICAL_BASELINE` string | CONFIRMED |

---

## 2. BLOCKER findings

### R1-BLOCK-01 — Workflow documents contradict the adopted contract and instruct backend to treat READY operations as frontend-local

`canonical-design/workflows/order-confirmation.md` and `canonical-design/workflows/return-credit-refund.md` both state:

> "No dedicated ready transport was conclusively mapped. Treat the semantic boundary as frontend-local/demo, composed read model, or a transport gap until a contract decision says otherwise."

The adopted contract declares, under exactly those workflow path prefixes:

| Operation | Method / path | Status | `x-transaction-boundary` |
|---|---|---|---|
| `confirmOrderWithPaymentPlan` | POST `/workflows/order-confirmation/{orderId}/confirm-with-payment-plan` | PRODUCTION_CONTRACT_READY | `SINGLE_BACKEND_TRANSACTION` |
| `resolveReturnCreditRefund` | POST `/workflows/return-credit-refund/{returnId}/resolve-credit-refund` | PRODUCTION_CONTRACT_READY | `BACKEND_ORCHESTRATED_SAGA` |
| `getReturnCreditRefundResolution` | GET `/workflows/return-credit-refund/{returnId}/resolutions/{resolutionId}` | PRODUCTION_CONTRACT_READY | — |

A backend implementer reading the canonical workflow documents would conclude that order confirmation and return credit/refund have no backend transport. This is the exact failure the workflow's own acceptance line forbids ("A blocked/missing transport never falls back to browser-authored success"), inverted.

Corroborated by `docs/backend-readiness/workflow-ownership.json`: WF-13 `order-confirmation` = `READY_WITH_BLOCKED_VARIANT` / `BACKEND_TRANSACTION_ROLLBACK`; WF-17 `return-credit-refund` = `PRODUCTION_CONTRACT_READY` / `BACKEND_SAGA`.

Affected: `canonical-design/workflows/order-confirmation.md`, `canonical-design/workflows/return-credit-refund.md`.
Classification: CONTRACT_MISMATCH.

### R1-BLOCK-02 — Traceability matrix is not trustworthy

`canonical-design/traceability/traceability-matrix.md`:

- Records `confirmOrder` as transport evidence for WORKFLOW-ORDER-CONFIRMATION. **`confirmOrder` is not an operationId in `docs/api/openapi.json`.**
- Records `executeReturnCreditRefund` for WORKFLOW-RETURN-CREDIT-REFUND. That is a frontend function symbol, not an operationId.
- Marks `gap/heuristic` for WORKFLOW-ORDER-CLOSING, WORKFLOW-ORDER-SHIPPING-BOOKING, WORKFLOW-RETURN-RESOLUTION, WORKFLOW-DEAL-RECYCLE, WORKFLOW-CUSTOMER-ONBOARDING — while the corresponding workflow documents correctly list ready or blocked operations for each (`completeOrderFromFulfillmentEvidence`, `createOrderOutboundShippingBooking`, 5 return-resolution operations, `markDealLostAndPlanRecycle`, `completeCustomerOnboarding`).
- MODULE-COMMERCIAL-EVIDENCE transport cell is the literal string `???`.

So the matrix disagrees with the contract *and* with the canonical workflow documents, in both directions. The orchestrator hard gate "canonical docs cannot trace critical behavior to source/contract evidence" is not satisfied.

Affected: `canonical-design/traceability/traceability-matrix.md`.
Classification: DOC_MISINTERPRETATION + internal inconsistency.

### R1-BLOCK-03 — Five PRODUCTION_CONTRACT_READY cross-module workflows have no canonical workflow document

`docs/backend-readiness/workflow-ownership.json` registers 27 workflows. `canonical-design/workflows/` documents 22 — those derived from `src/workflows/` directories. Missing entirely:

| Registry | Workflow | Readiness | Compensation owner | Ready operations |
|---|---|---|---|---|
| WF-23 | `refund-provider-recovery` | PRODUCTION_CONTRACT_READY | `BACKEND_PROVIDER_ADAPTER` | `retryRefundIntent`, `requestRefundCancellation` (`SINGLE_REFUND_RECOVERY_REQUEST_TRANSACTION`) |
| WF-24 | `lead-identity-resolution` | PRODUCTION_CONTRACT_READY | BACKEND | `mergeLeadDuplicates`, `confirmLeadDuplicatesDistinct` (`ATOMIC_MULTI_LEAD_IDENTITY_RESOLUTION_TRANSACTION`) |
| WF-25 | `lead-handover` | PRODUCTION_CONTRACT_READY | BACKEND | `handoverLeadWithTasks` (`SINGLE_BACKEND_CROSS_MODULE_TRANSACTION`) |
| WF-26 | `lead-follow-up` | PRODUCTION_CONTRACT_READY | BACKEND | `scheduleLeadFollowUpBatch` |
| WF-27 | `lead-queue-claim` | PRODUCTION_CONTRACT_READY | BACKEND | `claimLeadFromQueue` |

The operations themselves appear in `operation-catalog.md` and the owning module files, so no ready operation is missing from the design outright — but the multi-owner coordination, transaction boundary and compensation semantics for five ready workflow endpoints are undefined. `12-workflow-catalog.md` presents 22 as the complete set.

Affected: `canonical-design/12-workflow-catalog.md`, `canonical-design/workflows/` (5 documents absent), `canonical-design/traceability/traceability-matrix.md`, `canonical-design/README.md` ("22 cross-module workflow boundaries").
Classification: DOC_OMISSION.

### R1-BLOCK-04 — Record access, ownership and field security are underspecified, and one documented rule is contradicted by source

`06-roles-permissions-record-access.md` (1,049 bytes) is the entire canonical treatment. Against `src/platform/access-control/domain/evaluateEffectiveAccess.ts` and `src/platform/record-ownership/domain/`:

1. **Data-scope combination is most-permissive, and is not documented.** `getDataScope()` sorts by `scopeRank` descending and returns the *broadest* scope across the member's roles (`CUSTOM` 0 < `OWN` 1 < `TEAM` 2 < `WORKSPACE` 3). The document states the most-restrictive combination rule for *field* policies only and is silent on data scope. A backend implementing "most restrictive" symmetrically would produce a different authorization result.
2. **Default field access diverges between runtimes and is not documented.** `getFieldAccess()` returns `READ_WRITE` when no policy matches, while `AuthorizationContextProjection.unlistedFieldAccess` is documented in source as "connected projections remain fail-closed when a field is omitted". Neither default appears in canonical design.
3. **Ownership attribution is undefined.** Source attributes ownership from `ownerId | assigneeId | createdBy | assignedTo`, and team membership from `teamId | assignedTeam | teamIds[]`, including transitive team match via the member directory. None of this is in canonical design, so record-level access cannot be implemented from it.
4. **Default scope with no policy is `CUSTOM` (deny unless `allowedOwnerIds` matches).** Not documented.
5. **Product-space derivation is a concrete rule** (`crm` if any capability is not prefixed `studio.`/`access.`/`audit.`; `studio` if `studio.read|studio.configure`; `people` if `access.read|access.configure|audit.read`). Doc 06 says only "Product-space access derives from capabilities."
6. `OwnershipResourceKey` is implemented for `leads | deals | contacts` only, while `EFFECTIVE_RECORD_ACCESS_PROFILES` spans many more resources. The asymmetry is undocumented.

Hard gate "auth/workspace/permission/ownership semantics are unresolved" is not satisfied.

Affected: `canonical-design/06-roles-permissions-record-access.md`, `canonical-design/05-auth-session-workspace-tenancy.md`.
Classification: DOC_OMISSION + DOC_MISINTERPRETATION.

### R1-BLOCK-05 — Codex's five BLOCKERs are confirmed and must stay blocked

Independently re-verified; no change requested.

- `F-BLOCK-OPENAPI` — 34 blocked operations, 0 with a 2xx implementation contract. All 34 ids and decision ids match `blocked-contracts.md`. **KEEP BLOCKED.**
- `F-BLOCK-COMMANDS` — 17 command-registry entries with `status: BLOCKED`, `requiredCapability: UNRESOLVED`, `idempotencyPolicy: UNRESOLVED_BLOCKED`. Confirmed.
- `F-BLOCK-QUERY` — commercial-evidence has **zero** operations in OpenAPI (`x-module-owner` distribution has 14 business modules, not 15). Confirmed.
- `F-BLOCK-PLATFORM` — audit-trail / external-authority-health connected projections unresolved. Confirmed against `docs/backend-readiness/unresolved-decisions.json`.
- `F-BLOCK-CONFORMANCE` — live provider conformance not executed. Confirmed; not executed in this review either (see §7).

---

## 3. HIGH findings

### R1-HIGH-01 — State machines are state lists; source transition tables were discarded

`10-state-machines.md` lists state *sets* with no transitions, preconditions or outcomes. Source contains explicit transition maps in six modules: `leads/domain/rules/leadLifecycle.ts`, `orders/domain/rules/orderLifecycle.ts`, `quotes/domain/rules/quoteVersioning.ts`, `returns/domain/rules/returnLifecycle.ts`, `support/domain/rules/supportCaseLifecycle.ts`, `tasks/domain/rules/taskLifecycle.ts`.

Example — returns (`returnLifecycle.ts`) is a complete, unambiguous table: `REQUESTED→{APPROVED,REJECTED}`, `APPROVED→{AWAITING_ITEM,RECEIVED}`, `AWAITING_ITEM→{RECEIVED}`, `RECEIVED→{RESOLVED}`, `RESOLVED→{CLOSED}`, `CLOSED→∅`, `REJECTED→∅`. The canonical design renders it as one corrupted arrow string (see M-02) that loses `REJECTED` as a terminal branch.

Example — quotes (`quoteVersioning.ts`): `DRAFT→{REVIEW,SENT}`, `REVIEW→{DRAFT,SENT}`, `SENT→{ACCEPTED,REJECTED,EXPIRED}`, terminal otherwise, plus self-transition allowed. Canonical design gives only the 6 state names.

Sub-state machines omitted entirely: `QuoteApprovalStatus` (`NOT_REQUIRED|PENDING|APPROVED|CHANGES_REQUESTED`), `ReturnIntentStatus` (`PENDING|SUCCEEDED|FAILED`), `ReturnIntentTarget`/`ReturnIntentAction`, `ReturnResolution` union (5 variants), `RepairJob.status`.

Skill 09 requires "transitions have preconditions and outcomes" and "terminal/retention behavior is defined". Not satisfied.

Affected: `canonical-design/10-state-machines.md`, all `canonical-design/modules/*.md` "Business rules and lifecycle" sections.

### R1-HIGH-02 — All 162 registered queries are absent from canonical design

`README.md` claims "162 query registry entries" and `contract-reconciliation.md` claims "Queries: 162/162 classified", but `11-use-case-catalog.md` contains 173 `CMD-` rows and **zero `QRY-` rows**. No other canonical file enumerates queries.

99 of the 162 have no production transport (`COMPOSED_READ_MODEL` 66, `FRONTEND_LOCAL` 27, `DEMO_ONLY` 5, `BFF_CANDIDATE` 1). These define read-model obligations and non-obligations that a backend implementer must know; `F-BLOCK-QUERY` covers only commercial-evidence. Review axis 12 (command/query boundaries) is half-covered.

Affected: `canonical-design/11-use-case-catalog.md`, `canonical-design/README.md`.

### R1-HIGH-03 — 22 workflow documents are byte-identical boilerplate below the goal line

The "Business sequence and transaction boundary", "Outcomes and recovery" and "Acceptance scenarios" sections are **identical across all 22 workflow files** (verified by hashing each section per file: one hash each). Every workflow says "Execute the coordinated writes in one backend transaction when local atomicity is required, or a durable saga when provider/external steps intervene" — no workflow states which one it is.

The repository already holds the per-workflow answer: `workflow-ownership.json` declares `ownershipDecision` (`EVENT_DRIVEN` / `BACKEND_ORCHESTRATED` / `SINGLE_BACKEND_TRANSACTION`), `idempotencyBoundary` and `compensationOwner` per workflow; the contract declares 88 distinct `x-transaction-boundary` values. None reached the canonical design.

Affected: all 22 files under `canonical-design/workflows/`.

### R1-HIGH-04 — Incorrect business rule: "Active Deals require a next action"

`09-business-rules.md` and `modules/deals.md` state this as an invariant. Source (`src/modules/deals/domain/rules/dealStages.ts` `validateDealInvariant`) enforces only:
- `Deal requires a canonical buyerRef` — **this real invariant is missing from canonical design**;
- `WON` requires `winEvidence` (`QUOTE_ACCEPTED | ORDER_CONFIRMED`) — correctly documented;
- `LOST` requires `lostReason` + `recycleDecision`, and `revisitAt` when recyclable — correctly documented.

Next action is a *pipeline-health projection* in `dealPipelineHealth.ts`: `nextStepStatus ∈ {MISSING, OVERDUE, ON_TRACK}` derived from `nextActionSummary` + `nextActionAt`, plus `stale` when `daysSinceLastActivity ≥ 14 || daysInStage ≥ 21`. A backend implementing the canonical sentence literally would reject valid Deals. The 14/21-day thresholds and the health projection are undocumented.

Affected: `canonical-design/09-business-rules.md`, `canonical-design/modules/deals.md`.
Classification: DOC_MISINTERPRETATION.

### R1-HIGH-05 — Six platform/workspace contract owners have no owner document

65 of 270 operations are owned by `platform/workspace-config` (20), `platform/access-control` (13), `workspaces/studio` (14), `platform/identity-auth` (10), `platform/integrations` (6), `platform/workspace-context` (2). `canonical-design/modules/` covers only the 15 business modules, and the ownership table in `03-architecture-and-ownership.md` has no rows for these owners.

Consequently there is no design statement for: workspace configuration draft/publish lifecycle (`updateWorkspaceBlueprint`, `publishWorkspaceConfiguration`, `listWorkspaceConfigurationAudit`), Studio quick-setup step lifecycle (5 operations), access governance member/invitation/role lifecycle (13 operations, incl. `rotateManagedMemberPassword`), or integration connection lifecycle. `src/workspaces/studio` (31 files) and `src/workspaces/people-access` (22 files) are referenced nowhere in `canonical-design/` except as operation rows.

Affected: `canonical-design/03-architecture-and-ownership.md`, `canonical-design/modules/` (6 owner documents absent), `canonical-design/04-product-spaces-routes-capabilities.md`.

### R1-HIGH-06 — Frontend conformance review asserts coverage it does not evidence

`design-reconstruction/reviews/frontend-conformance-report.md` is 15 lines and claims "Coverage used the inventory indexes for all 78 routes, 62 loadable modules, 123 capabilities, 13 workspace flags, presentation/controller files, guidance/i18n and critical journeys", then reports five aggregate bullets.

Skill 08 requires itemised treatment of route guards, screen actions, forms, validation, list/search/filter/sort/page, status/action visibility, workspace switching, auth/session states, import/export, provider states, Studio configuration flows and People & Access flows. None appear. Counting inventory rows is not conformance review; the report cannot be used as gate evidence.

Affected: `design-reconstruction/reviews/frontend-conformance-report.md`.

### R1-HIGH-07 / R1-HIGH-08 — Codex's HIGH findings confirmed

- `F-HIGH-MONEY` — confirmed. Decimal-string `MoneyDto` in `src/shared/money/money.ts` and OpenAPI (`x-shared-conventions.money`: "Decimal string amount plus ISO 4217 currency") coexisting with `number` commercial fields in Product/Deal/Quote/Order. Rounding/minor-unit rule is genuinely absent from source and contract (no divide/round function exists), so DEC-002 correctly leaves it to backend decision.
- `F-HIGH-INVENTORY` + `F-HIGH-DOCUMENT-STATUS` — both reproduced by executing `npm run repo:check` and `quality.backend-readiness`. The governance conflict is real: the workflow forbids modifying `docs/`, and the gate requires every repository Markdown file to be registered in `docs/document-status.json`. Adding this review file cannot avoid the conflict; it is inherent and must be decided by a repository-governance owner.

---

## 4. MEDIUM findings

| ID | Finding | Affected files |
|---|---|---|
| M-01 | **Contract mismatch (owner).** `replaceWorkspaceCurrencies` and `putWorkspaceExchangeRate` are documented with owner `workspaces/studio`; OpenAPI `x-module-owner` is `platform/workspace-config` for both. These are the only 2 field-level deviations in 270 rows × 6 fields. | `contracts/operation-catalog.md`, `contracts/blocked-contracts.md` |
| M-02 | **Literal `???` placeholder corruption** in 8 canonical files (non-ASCII arrows and em dashes lost on write). Semantically damaging in `10-state-machines.md:20` (`REQUESTED ??? APPROVED/REJECTED ???…`), `07-domain-model.md:13` (whole commercial chain), `modules/returns.md:57`; unreadable table cells in `modules/commercial-evidence.md:49` and `traceability/traceability-matrix.md:9`; 50 rows in `11-use-case-catalog.md` (there `???` means "none", inferable but undeclared). Also 8 occurrences in `design-coherence-report.md`. | 8 canonical files + 1 review file |
| M-03 | `analysis-state.json` reports `sourceFilesClassified: 1986` while its own `classifications` sum to 2,064 (the ledger's `repositoryFilesIncludingOutputs`). | `design-reconstruction/state/analysis-state.json` |
| M-04 | `design-coherence-report.md` says "HIGH: 2 findings" then lists three `F-HIGH-*` entries; `analysis-state.json` lists 3. | `design-reconstruction/reviews/design-coherence-report.md` |
| M-05 | 40+ existing documents are classified `ADOPT_WITH_CORRECTION` in `existing-document-reconciliation.md`, but no correction is recorded anywhere. The classification asserts corrections were identified; none are retrievable. | `design-reconstruction/reviews/existing-document-reconciliation.md` |
| M-06 | Forensic jargon `gap/heuristic` appears in `canonical-design/`. `OUTPUT_LAYOUT.md` states "No raw forensic notes, confidence scratchpads, temporary findings, or AI caches are allowed here." | `canonical-design/traceability/traceability-matrix.md` |
| M-07 | Contract metadata never surfaced in the design: `x-credentials-policy: INCLUDE` on 39 operations (credentialed transport — a security-relevant decision, zero mentions of "credential" in `canonical-design/`); 138 distinct `x-event-outbox-expectation`, 26 distinct `x-audit-requirement`, 88 distinct `x-transaction-boundary`. Deferring exact format to OpenAPI is legitimate; giving the reader no signal that these dimensions exist is not. | `canonical-design/contracts/conventions.md`, `contracts/operation-catalog.md` |
| M-08 | "Cross-module dependencies: None in the semantic source packet" is *technically true* for domain/application/public (verified: only `orders → contacts`), but real coupling exists at infrastructure/presentation level (e.g. `orders` imports 10 modules, `customers` imports 13) and is documented nowhere. The phrasing reads as an architectural claim it does not support. | 10 of 15 `canonical-design/modules/*.md` |
| M-09 | Deal stages are presented as a fixed 7-value enum, but source and contract support workspace-configured pipelines and stages (`OpportunityStageConfig` with `isSystem`/`isActive`/`category`, `normalizeDealStageCode`, plus `createCrmPipeline`/`createCrmPipelineStage` operations). The canonical design mentions "pipeline stage configuration projection" in doc 03 only. | `canonical-design/10-state-machines.md`, `modules/deals.md` |
| M-10 | Auth/session enumerations are absent from canonical design: `UserAccountStatus`, `IdentityProvider` (5), `AuthenticationChallenge.type` (5), `AuthFailureCode` (19), `SecurityEvent.type` (11), `WorkspaceInvitation.status` (4), `UserCredentialReference.type`. Severity limited to MEDIUM because OpenAPI does define the wire equivalents (`IdentityAccountStatus`, `IdentitySessionStatus`, `IdentityAssuranceLevel`, `WorkspaceInvitationStatus`, `x-error-codes` on all 270 operations) — but doc 05 does not point the reader there. | `canonical-design/05-auth-session-workspace-tenancy.md` |
| M-11 | `design-reconstruction/tooling/` is not part of the prescribed layout in `OUTPUT_LAYOUT.md`. Non-authoritative directory, so impact is presentational. | `design-reconstruction/tooling/` |

---

## 5. Summary tables

### Contract mismatches

| # | Kind | Detail |
|---|---|---|
| 1 | READY operation documented as absent | `confirmOrderWithPaymentPlan` — R1-BLOCK-01 |
| 2 | READY operation documented as absent | `resolveReturnCreditRefund` — R1-BLOCK-01 |
| 3 | READY operation documented as absent | `getReturnCreditRefundResolution` — R1-BLOCK-01 |
| 4 | Non-existent operationId cited | `confirmOrder` — R1-BLOCK-02 |
| 5 | Frontend symbol cited as transport | `executeReturnCreditRefund` — R1-BLOCK-02 |
| 6 | Owner mismatch | `replaceWorkspaceCurrencies` — M-01 |
| 7 | Owner mismatch | `putWorkspaceExchangeRate` — M-01 |

No blocked operation was presented as implementable. No ready operation is missing from `operation-catalog.md`. No fabricated 2xx contract was found.

### Incorrect or missing business rules

| Rule | Status |
|---|---|
| "Active Deals require a next action" | INCORRECT — health projection, not invariant (R1-HIGH-04) |
| "Deal requires a canonical buyerRef" | MISSING (R1-HIGH-04) |
| Deal staleness thresholds (14 days inactivity / 21 days in stage) | MISSING (R1-HIGH-04) |
| Data-scope combination across roles = most permissive | MISSING (R1-BLOCK-04) |
| Default data scope with no policy = `CUSTOM` (deny) | MISSING (R1-BLOCK-04) |
| Default field access: `READ_WRITE` (demo) vs fail-closed (connected) | MISSING (R1-BLOCK-04) |
| Record ownership attribution fields and transitive team match | MISSING (R1-BLOCK-04) |
| Product-space derivation rule from capability prefixes | MISSING (R1-BLOCK-04) |
| Per-state transition tables (6 modules) | MISSING (R1-HIGH-01) |
| Quote approval / return intent / repair sub-lifecycles | MISSING (R1-HIGH-01) |
| Configurable deal pipelines and stages | UNDERSTATED (M-09) |
| Quote self-transition allowed (`from === to` returns true) | MISSING (R1-HIGH-01) |

### Unresolved design decisions

Carried forward from Codex (all confirmed, none resolved by this review): `DEC-001` (26 blocked OpenAPI decision groups + 17 blocked commands), `DEC-002` (financial value authority / rounding / minor units), `DEC-003` (platform connected projections), `DEC-COMMAND-SEMANTICS`, `DEC-QUERY-COMMERCIAL-EVIDENCE-COVERAGE`, `DEC-P09-LIVE-PROVIDER-CONFORMANCE`, plus the 24 operation-level `DEC-*` ids in `analysis-state.json`.

Newly surfaced and unrecorded:

| Decision needed | Origin |
|---|---|
| Whether the 5 unmodelled workflows (WF-23…WF-27) are in scope for canonical design | R1-BLOCK-03 |
| Whether `workflow-ownership.json` `DEC-WORKFLOW-*` ids (11) and `DEC-P02-ORDER-CREDIT-APPROVAL-COMMAND`, `DEC-P04-REFUND-CANCEL-RETRY` are current or superseded — they appear in no canonical or reconstruction artifact | `docs/backend-readiness/workflow-ownership.json` |
| Authoritative unlisted-field-access default for connected mode | R1-BLOCK-04 |
| Authoritative data-scope combination rule for the backend | R1-BLOCK-04 |
| Canonical owner for `replaceWorkspaceCurrencies` / `putWorkspaceExchangeRate` | M-01 |
| Resolution of the `docs/document-status.json` governance conflict | F-HIGH-DOCUMENT-STATUS |

### Affected canonical-design files

`README.md`, `03-architecture-and-ownership.md`, `04-product-spaces-routes-capabilities.md`, `05-auth-session-workspace-tenancy.md`, `06-roles-permissions-record-access.md`, `07-domain-model.md`, `09-business-rules.md`, `10-state-machines.md`, `11-use-case-catalog.md`, `12-workflow-catalog.md`, `contracts/operation-catalog.md`, `contracts/blocked-contracts.md`, `contracts/conventions.md`, `traceability/traceability-matrix.md`, `modules/deals.md`, `modules/commercial-evidence.md`, `modules/returns.md`, 10 further `modules/*.md` (M-08), all 22 `workflows/*.md`.

Files reviewed and found sound: `00-document-control.md`, `01-product-scope.md`, `02-system-context-and-boundaries.md`, `08-data-dictionary.md`, `13-money-financial-semantics.md`, `contracts/README.md`, `contracts/contract-authority.md`, `contracts/contract-source-manifest.json`, `acceptance/backend-acceptance-criteria.md`, `decisions/DEC-001..003`.

---

## 6. Checks actually executed

1. OpenAPI parse: 240 paths, 270 operations, 270 unique operationIds, 603 schemas, `x-*` extension census.
2. SHA-256 of `docs/api/openapi.json` vs `docs/api/openapi.sha256` vs `00-document-control.md`.
3. Full field-level diff of `operation-catalog.md` (270 rows × owner/transport/status/capability/idempotency/concurrency) against OpenAPI.
4. `blocked-contracts.md` id + decision-id + owner diff against `x-contract-status: BLOCKED` set.
5. Full row diff of `11-use-case-catalog.md` (173 rows) against `docs/backend-readiness/command-registry.json`.
6. Query registry recount and classification split from `docs/backend-readiness/query-registry.json`.
7. Repository census: expanded `git ls-files` plus recursive untracked expansion to 2,064 paths; bidirectional set-diff against `source-coverage-ledger.json`; duplicate check; classification-sum check.
8. `ROUTE_KEYS` parsed from `src/platform/navigation/routeKeys.ts` (78) → `docs/quality/repository-inventory.json` → `04-*.md`; path-level equality check.
9. Capability set equality: 123 inventory values vs 123 doc values.
10. Workspace flag set + optional/required equality (13).
11. Cross-module import analysis per module, both full-module and domain/application/public-only.
12. Section-hash comparison of all 22 workflow documents (business sequence / outcomes / acceptance).
13. Workflow path-prefix mapping of all 19 `/workflows/*` operations against each workflow document's "API operations" section.
14. `docs/backend-readiness/workflow-ownership.json` (27 entries) set-diff against `canonical-design/workflows/`.
15. Transaction-boundary lookup for the operations of the 5 unmodelled workflows.
16. Traceability-matrix transport cells validated against the operationId set.
17. Source reads for verification: `money.ts`, `exchangeRate.types.ts`, `auth.types.ts`, `evaluateEffectiveAccess.ts`, `accessControl.types.ts`, `accessGovernance.types.ts`, `recordOwnership.types.ts`, `recordOwnership.rules.ts`, `effectiveRecordAccessCatalog.ts`, `deal.types.ts`, `dealStages.ts`, `dealPipelineHealth.ts`, `quote.types.ts`, `quoteVersioning.ts`, `return.types.ts`, `returnLifecycle.ts`, `workspaceCapabilityManifest.ts`, `canonicalRoutes.ts`, `routeMeta.ts`, `workspaceBootstrap.types.ts`.
18. Transition-table census across `src/modules` (`TRANSITIONS|canTransition|ALLOWED_TRANSITIONS`).
19. Lifecycle enum cross-check against `docs/backend-readiness/lifecycle-enum-inventory.json` (84 symbols).
20. `???` corruption census across `canonical-design/` and `design-reconstruction/`.
21. Executed `npm run api:check` → PASS.
22. Executed `npm run repo:check` → FAIL (reproduced Codex's report).
23. Executed `npm run quality:gate -- --gate quality.backend-readiness` → FAIL (reproduced).
24. Confirmed absence of `canonical-design/BASELINE.json` and of any `CANONICAL_BASELINE` status string.

## 7. Checks NOT executed, and why

| Check | Reason |
|---|---|
| Live provider conformance against a provisioned backend and two workspaces | No backend exists; the repository is frontend-only. This is `F-BLOCK-CONFORMANCE`, `BLOCKED_EXTERNAL`. Cannot be discharged by review. |
| Browser E2E (`npm run e2e`, `e2e:critical`, `e2e:connected`) | Requires a browser install and a running app; the review scope is design conformance, not runtime behaviour. Codex likewise did not run it and said so. |
| Full `npm run verify` | Known to stop at the backend-readiness gate; that gate was run directly instead, which isolates the same failure at lower cost. Upstream gates (lint/typecheck/unit/contract) are unchanged by this review since no source was modified. |
| Line-by-line reading of all 2,064 files | Prohibited by the workflow's token-economy rule and unnecessary — coverage was verified structurally (ledger ↔ disk set equality) and semantically by targeted deep reads of the files the canonical claims depend on. |
| Independent re-derivation of the 123-capability set from `capabilityCatalog.ts` | Verified transitively (source route keys → inventory → doc matched exactly, establishing the inventory as a faithful index), so a second derivation path was not required for round 1. Worth doing in round 2 if the capability catalog changes. |
| Schema-level (request/response body) diff of the 236 ready operations | Out of scope: `contract-authority.md` correctly assigns exact wire format to OpenAPI, and the canonical design does not restate schemas, so there is no restatement to falsify. |
| Studio / People & Access screen-level conformance | Deferred — blocked behind R1-HIGH-05: there is no canonical owner document for those surfaces to conform *to*. Re-run once those documents exist. |

---

## 8. Recommendation for round 2

Blocking, in order: R1-BLOCK-01 and R1-BLOCK-02 (contract contradictions — cheap, mechanical, and currently the most dangerous for an implementer); R1-BLOCK-03 (5 missing workflow documents); R1-BLOCK-04 (access/ownership specification). Then R1-HIGH-01/02/03/05. M-02 should be fixed in the same pass as any file it touches, since it silently degrades the state-machine and domain-chain statements.

Codex's five BLOCKERs and three HIGHs remain open and correctly block the baseline independently of everything above.
