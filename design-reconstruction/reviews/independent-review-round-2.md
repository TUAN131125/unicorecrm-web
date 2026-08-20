# Independent review — round 2

Status: NON_AUTHORITATIVE REVIEW.
Role: independent reviewer (Codex is the implementer).
Mode: `baseline` readiness review. No baseline created; `canonical-design/`, `docs/` and `src/` were not modified.
Artifact under review: `canonical-design/` @ `unicorecrm-web@0.23.20-contract.0`, plus `design-reconstruction/`.

## Result

**READY_FOR_FINAL_BASELINE_REVIEW**

Every round-1 documentation defect was independently re-derived from source and contract, not accepted from the resolution note. All twelve verification targets pass. **No DESIGN_BLOCKER remains.**

The five findings named `F-BLOCK-*` and the three named `F-HIGH-*` were re-examined against what they actually assert. None of them is an unresolved ambiguity, contradiction, missing authority or missing semantic rule. Four are deferred capabilities with explicitly known status and no fabricated behavior; one is a live-backend validation that cannot exist yet; two are repository-governance side effects of adding the reconstruction namespaces; one is design debt whose premise is partly falsified by the adopted contract.

The prior `NOT_READY_TO_BASELINE` verdict rested on the rule "a finding named BLOCKER blocks the baseline". Applied to what these findings contain, that rule is wrong: it would make the baseline unreachable, because `F-BLOCK-CONFORMANCE` can only be discharged by a backend that the baseline itself is meant to authorize.

---

## 1. Verification of round-1 corrections

All checks re-derived independently. Method is listed in §6.

| # | Correction claimed | Independent verification | Result |
|---|---|---|---|
| 1 | 27/27 workflow coverage | `workflow-ownership.json` (27 entries) set-diffed against `canonical-design/workflows/` filenames | **PASS** — 27 docs, 0 registry workflows without a doc, 0 docs without a registry entry |
| 2 | Workflow-specific semantics | SHA-1 of each `##` section across all 27 docs; grep for the round-1 generic sentence | **PASS** — Goal/Trigger/Preconditions/Business sequence/Success outcome/Failures/Transport mapping/Acceptance all 27 distinct; generic sentence 0 occurrences; all 27 state their registry `ownershipDecision` |
| 3 | 162/162 query classification | every `stableQueryId` in `query-registry.json` searched in `canonical-design/` | **PASS** — 162 `QRY-` rows in `11-use-case-catalog.md`, 0 absent; 173 `CMD-` rows retained |
| 4 | Six explicit state-transition tables | `TRANSITIONS\|canTransition` census across `src/modules/*/domain/rules/`; each table read and compared literally | **PASS** — exactly 6 modules have tables, all 6 documented, all edges exact (see §2) |
| 5 | Record access and ownership semantics | `evaluateEffectiveAccess.ts`, `accessGovernance.types.ts`, `recordOwnership.*` read line-by-line | **PASS** — all six round-1 gaps closed and correct (see §2) |
| 6 | buyerRef invariant | `dealStages.ts:108` | **PASS** — "Every Deal requires a canonical buyerRef" present in `09-business-rules.md:24` and `modules/deals.md:55` |
| 7 | False "Active Deals require a next action" invariant | `dealStages.ts` `validateDealInvariant` vs `dealPipelineHealth.ts:69` | **PASS** — reclassified as a pipeline-health projection; 14-day/21-day thresholds documented and exact |
| 8 | 65/65 platform/workspace operation ownership | OpenAPI `x-module-owner` census vs `canonical-design/platform/*.md` | **PASS** — 65/65, 0 missing; all six owners also referenced in `03-architecture-and-ownership.md` |
| 9 | Real operationIds in traceability | every token in the operationId column matched against the 270-id set | **PASS** — 270/270 cited, 0 fabricated; `confirmOrder` and `executeReturnCreditRefund` gone; non-transport rows carry explicit `None - <reason/decision-id>` labels; `gap/heuristic` 0 occurrences |
| 10 | Frontend conformance evidence | report re-read against skill 08 axes | **PASS** — 16 itemised axes with VERIFIED/PARTIAL/NOT_VERIFIED/CONFLICT, traceable evidence and stated runtime limits; no unevidenced coverage claim |
| 11 | Removal of literal `???` corruption | grep across `canonical-design/` and `design-reconstruction/` | **PASS** — 0 in `canonical-design/`; the only 3 remaining are inside `independent-review-round-1.md`, where they are quoted evidence |
| 12 | Two owner mismatches | full field diff of all 270 catalog rows against OpenAPI | **PASS** — `replaceWorkspaceCurrencies` and `putWorkspaceExchangeRate` now `platform/workspace-config` in both catalog and blocked list; **0 owner, 0 status, 0 transaction-boundary, 0 capability mismatches across 270 rows** |
| 13 | WF-12 contract/registry conflict | registry readiness vs mapped `/workflows/<name>/` operation status, all 27 workflows | **PASS** — WF-12 is the *only* conflict in 27; `order-closing.md:40` declares it as `CONFLICT` and states the authority rule (OpenAPI controls HTTP transport) |

Additional regressions checked and clear:

- **R1-BLOCK-01** — no workflow doc contains "frontend-local/demo" or "no dedicated ready transport was conclusively mapped". `order-confirmation.md` and `return-credit-refund.md` now map their three READY operations with correct transaction boundaries.
- Contract integrity — `docs/api/openapi.json` SHA-256 `8278547d…f402757` matches `openapi.sha256` and `00-document-control.md`; 270 operations / 236 ready / 34 blocked; `npm run api:check` **PASS**.
- Coverage — ledger holds 2,077 entries, 0 unclassified, classifications sum to 2,077. `sourceSnapshotFiles: 1986` and `repositoryFilesIncludingOutputs: 2077` are now both declared, closing M-03.
- Severity counts — `design-coherence-report.md` and `analysis-state.json` both say 5 BLOCKER / 3 HIGH, closing M-04.
- Baseline discipline — no `BASELINE.json`, no `CANONICAL_BASELINE` string, all 73 canonical Markdown files carry `RECONSTRUCTED_DRAFT`. 0 tracked files modified; `src/` and `docs/` untouched.

## 2. Semantic claims re-derived from source

These were checked literally rather than accepted, because they are the claims a backend would implement.

**Transition tables.** `returnLifecycle.ts` — `REQUESTED→{APPROVED,REJECTED}`, `APPROVED→{AWAITING_ITEM,RECEIVED}`, `AWAITING_ITEM→{RECEIVED}`, `RECEIVED→{RESOLVED}`, `RESOLVED→{CLOSED}`, `CLOSED`/`REJECTED` terminal, no same-state edge — reproduced exactly at `10-state-machines.md:58-59`, including `REJECTED` as a terminal branch that round 1 found lost to corruption. `quoteVersioning.ts` — `from === to` returns `true`; the canonical text states "same-state replay is allowed", which round 1 recorded as missing. `taskLifecycle.ts` and `supportCaseLifecycle.ts` reproduced edge-for-edge, including the support reopen paths from `cancelled` and `closed`.

**Access and ownership.** `evaluateEffectiveAccess.ts` — `scopeRank {CUSTOM:0, OWN:1, TEAM:2, WORKSPACE:3}` sorted descending (most permissive) at line 78; empty policy set returns `CUSTOM` at line 77; `getFieldAccess` returns `READ_WRITE` on empty at line 106 and sorts ascending (most restrictive) at line 107; the fail-closed projection returns `CUSTOM`/`HIDDEN` at lines 57-59. All four appear correctly in `06-roles-permissions-record-access.md:9,21`, and the doc explicitly forbids connected mode copying the demo `READ_WRITE` default. Ownership attribution `[ownerId, assigneeId, createdBy, assignedTo]` confirmed at `evaluateEffectiveAccess.ts:29` and `accessGovernance.types.ts:192`; team candidates and transitive team match confirmed in `recordOwnership.rules.ts:62-70`. The `OwnershipResourceKey = "leads" | "deals" | "contacts"` asymmetry is documented at `06-*.md:17` as a presentation/runtime limit and explicitly *not* permission to omit backend record access elsewhere. Product-space derivation is stated as a concrete capability-prefix rule at line 25.

**Deals.** `validateDealInvariant` enforces exactly three things: buyerRef, WON⇒winEvidence, LOST⇒lostReason+recycleDecision(+revisitAt when recyclable). All three documented; nothing else asserted as an invariant. `dealPipelineHealth.ts:69` — `stale = !terminal && (daysSinceLastActivity >= 14 || daysInStage >= 21)` — reproduced verbatim.

## 3. Finding reclassification

| Finding | Previous severity | New classification | Blocks canonical design baseline? | Evidence | Required action | Owner of next action |
|---|---|---|---|---|---|---|
| **F-BLOCK-OPENAPI** | BLOCKER | **DEFERRED_CAPABILITY** | **NO** | 34 blocked operations parsed from `docs/api/openapi.json`: **0 declare any 2xx response**; **34/34 carry `x-blocking-decision-id`** across 26 decision groups; 34/34 present in `contracts/blocked-contracts.md` with matching ids, owners and decision ids; `blocked-contracts.md` contains 0 lines referencing a 2xx code. `acceptance/backend-acceptance-criteria.md:9,16` scopes the backend to "exactly all and only PRODUCTION_CONTRACT_READY operations" and requires proof that blocked operations are unavailable. | Carry the 26 decision groups into `BASELINE.json` as explicit unresolved non-blocking decisions. Do not resolve to baseline. | API Contract Architect (`DEC-001`) |
| **F-BLOCK-COMMANDS** | BLOCKER | **DEFERRED_CAPABILITY** | **NO** | All 17 `status: BLOCKED` entries inspected in `command-registry.json`. `requestSchema: null` and `successResponseSchema: null` on every one — no behavior fabricated. 16/17 have `openApiOperationId: null` *and* `blockedOperationCandidate: null`; the 17th (CMD-015) points at `markDealLostAndPlanRecycle`, which is itself `BLOCKED` in OpenAPI — consistent, not contradictory. All 17 appear in `11-use-case-catalog.md` with status BLOCKED and a decision id. `runtimeImplementationMode: DEMO_ONLY_LOCAL_EXECUTOR` on all 17. The one adjacency risk — CMD-047 `order.confirm` BLOCKED while `confirmOrderWithPaymentPlan` is READY — is explicitly disambiguated at `workflows/order-confirmation.md:49`: "A generic confirm or inline credit override is not a substitute". | Same as above. Record in `BASELINE.json` that 17 frontend capabilities remain demo-only in connected mode — a product-scope consequence, not a design defect. | Module Domain Owner + API Contract Architect (`DEC-COMMAND-SEMANTICS`) |
| **F-BLOCK-QUERY** | BLOCKER | **DEFERRED_CAPABILITY** | **NO** | Commercial-evidence owns 0 of 270 OpenAPI operations (14 business owners in the `x-module-owner` census, not 15) — confirmed. Its 3 queries (QRY-001/002/003) are classified `COMPOSED_READ_MODEL` under `DEC-P10-COMMERCIAL-EVIDENCE-COMPOSITION` — a *known* classification, not an unknown. `modules/commercial-evidence.md` fully specifies entities, invariants, commands, queries and CustomerState dimensions, and declares its API table as "None — no direct operation catalog owner" without inventing endpoints. The write path is not missing: `workflows/order-closing.md:34` appends idempotent PurchaseEvidence inside the READY `completeOrderFromFulfillmentEvidence` / `ORDER_COMPLETION_TRANSACTION`. | Record the read-transport decision in `BASELINE.json`. The module's design semantics are complete and need no further work. | API Contract Architect (`DEC-P10`) |
| **F-BLOCK-PLATFORM** | BLOCKER | **DEFERRED_CAPABILITY** | **NO** | `unresolved-decisions.json` → `DEC-PLATFORM-CONNECTED-PROJECTIONS`, `status: PARTIALLY_CLOSED`, `resolvedOperations: [evaluateEffectiveRecordAccess]`, `blockingOperations: [auditTrail.list, externalAuthorityHealth.evaluate]`, two named options ("Add typed OpenAPI read models" / "Remove connected UI feature"), named owner. `decisions/DEC-003` states the position without fabricating a read model. Exactly two operations, both named. | Record in `BASELINE.json`. | Identity/Platform Backend Owner (`DEC-003`) |
| **F-BLOCK-CONFORMANCE** | BLOCKER | **IMPLEMENTATION_VALIDATION_PENDING** | **NO** | No backend exists; the repository is frontend-only. Conformance is an *execution* result against a provisioned provider and two isolated workspaces — it is already an acceptance criterion at `backend-acceptance-criteria.md:15`. The intended design is not unknown: provider contract tests and fixtures are classified as conformance evidence in the contract-authority model. Treating this as a design blocker is circular — it cannot be discharged before the backend the baseline authorizes. | None before baseline. Enforce at backend acceptance, not at design baseline. | Backend Implementation Owner (`DEC-P09-LIVE-PROVIDER-CONFORMANCE`) |
| **F-HIGH-INVENTORY** | HIGH | **REPOSITORY_GOVERNANCE_ISSUE** | **NO** | `npm run repo:check` FAIL. Delta is exactly: `documentation` 178→292 (**+114**) and `active-script` 63→75 (**+12**). Independently counted: **114 `.md` files** across `canonical-design/` (73), `.ai-workflows/` (30), `design-reconstruction/` (9), `.agents/` (1), `.claude/` (1); and **12 non-Markdown artifacts** (11 `.json` + 1 `.txt`) in the same namespaces. 114 + 12 = 126 = the exact untracked file count. **0 tracked files modified.** The stored inventory is not wrong about the product; it predates the reconstruction namespaces. | Register or exclude the five new namespaces in `docs/quality/repository-inventory.json`. Requires the `docs/` write authority this workflow withholds. | Repository Governance Owner |
| **F-HIGH-DOCUMENT-STATUS** | HIGH | **REPOSITORY_GOVERNANCE_ISSUE** | **NO** | `quality.backend-readiness` FAIL. The unregistered set is exactly **114 entries**, distributed `canonical-design` 73, `.ai-workflows` 30, `design-reconstruction` 9, `.agents` 1, `.claude` 1 — **zero entries from `docs/` or `src/`**. The conflict is structural: the gate requires every repository Markdown file in `docs/document-status.json`, while `OUTPUT_LAYOUT.md` places output outside `docs/` and the workflow forbids modifying it. Adding this review file cannot avoid it. | Decide the governance rule: extend the gate's scope, add an exclusion for the reconstruction namespaces, or register them. Independent of design correctness. | Repository Governance Owner |
| **F-HIGH-MONEY** | HIGH | **NON_BLOCKING_DESIGN_DEBT** | **NO** | Its premise is partly falsified. The adopted contract **does** declare the rules round 1 recorded as absent: `components.schemas.Money` carries `x-rounding-mode: HALF_UP`, `x-currency-owner: WORKSPACE_CONFIGURATION`, `x-negative-policy: OPERATION_SPECIFIC`; `DecimalAmount` carries `x-maximum-scale: 6`; `ProductDocument.x-money-semantics` states outright that "Numeric frontend fields are display-only projections"; and four operation descriptions (`repriceQuoteDraft`, `repriceOrderDraft`, credit-note creation, lead direct-sale) assign tax/rounding/totals to the backend. `13-money-financial-semantics.md:7` routes correctly — "backend-authoritative *where the exact rule is not declared by the adopted contract*" — so there is no contradiction, and `contract-authority.md` keeps exact format with OpenAPI. Genuinely undeclared: per-currency minor units (0 mentions). Legacy `number` fields are a frontend refactor, and the contract already declares them non-authoritative. | Surface the declared money extensions in canonical design (see R2-01) and carry the minor-unit decision into `BASELINE.json` as non-blocking. | API Contract Architect (`DEC-002`) |

### New round-2 findings

| Finding | Classification | Blocks baseline? | Evidence | Required action | Owner |
|---|---|---|---|---|---|
| **R2-01** — money-semantics contract extensions never surfaced | NON_BLOCKING_DESIGN_DEBT | **NO** | M-07 was resolved for the four operation-level extensions (`x-credentials-policy`, `x-audit-requirement`, `x-event-outbox-expectation`, `x-transaction-boundary`, indexed as catalog columns), but the schema-level money extensions above appear in **no** canonical file — `HALF_UP` has zero occurrences in `canonical-design/`. Same defect class M-07 named: the reader gets no signal the dimension exists. No contradiction, and OpenAPI remains authoritative. | Add the four Money/DecimalAmount extensions to `contracts/conventions.md` and cite `x-rounding-mode` from doc 13. | Codex |
| **R2-02** — WF-12 readiness conflict recorded, not reconciled | NON_BLOCKING_DESIGN_DEBT | **NO** | `workflow-ownership.json` WF-12 `contractReadiness: BLOCKED` while `completeOrderFromFulfillmentEvidence` is `PRODUCTION_CONTRACT_READY`. Sole conflict across 27 workflows. `order-closing.md:40,50` declares it and resolves authority in OpenAPI's favour, so the backend instruction is unambiguous. The stale field sits in governed `docs/`, which this workflow may not edit. | Reconcile the registry field under `docs/` write authority. | Repository Governance Owner + API Contract Architect |

## 4. Why no DESIGN_BLOCKER remains

Tested against each element of the definition:

- **Unresolved ambiguity** — none found. The one place two sources disagree (WF-12) states which one wins.
- **Contradiction** — none found. 270/270 catalog rows match OpenAPI on owner, status, transaction boundary and capability. 270/270 traceability operationIds are real. No workflow document contradicts the contract. Every round-1 contradiction is closed.
- **Missing authority** — none found. `contract-authority.md` makes OpenAPI the C1 HTTP authority; money authority is assigned; access/ownership authority is documented and matches source; every blocked item has a named decision owner.
- **Missing semantic rule** — none found. Six transition tables verified edge-for-edge; access combination, defaults, ownership attribution and product-space derivation verified line-by-line; deal invariants corrected and verified.

The remaining items are, in each case, something other than a design defect: a capability deliberately withheld with its status recorded (four), a result that only a running backend can produce (one), a file-registration gate tripped by this workflow's own outputs (two), and a documentation gap whose underlying rule the contract already declares (one).

## 5. Conditions for the final baseline gate

Not blockers — conditions on `BASELINE.json` when it is created:

1. Record all 26 blocked OpenAPI decision groups, the 17 blocked command decisions, `DEC-P10`, `DEC-003` and `DEC-002` (minor units) under `unresolvedNonBlockingDecisions`.
2. State that backend acceptance scope is the 236 `PRODUCTION_CONTRACT_READY` operations, and that blocked operations must be provably unavailable.
3. State that live provider conformance is a backend acceptance gate, not a design gate.
4. Record the two repository-governance issues as open, with the governance owner named, and note they do not affect design content.
5. Record R2-02 (WF-12) as a known stale registry field superseded by OpenAPI.
6. Pin the source fingerprint `dfc18e12…6ac839f` and contract SHA-256 `8278547d…f402757`.

R2-01 is worth fixing before the gate — it is a few lines in `contracts/conventions.md` and doc 13, and it removes the last substantive complaint behind F-HIGH-MONEY.

## 6. Checks executed

1. OpenAPI parse — 270 operations, 270 unique operationIds, owner/status/capability/transaction census; full `x-` extension key enumeration (47 keys).
2. SHA-256 of `docs/api/openapi.json` vs `openapi.sha256` vs `00-document-control.md`.
3. Field-level diff of all 270 `operation-catalog.md` rows against OpenAPI (owner, status, transaction boundary, capability).
4. `blocked-contracts.md` — 34/34 id, owner and decision-id diff; 2xx-response scan of all 34 blocked operations; 2xx-mention scan of the document.
5. Traceability matrix — every operationId-column token validated against the 270-id set; coverage and non-transport label audit; `gap/heuristic` and `???` scans.
6. `workflow-ownership.json` (27) set-diffed against `canonical-design/workflows/`; per-section SHA-1 across all 27 documents; registry `ownershipDecision` presence check; generic-boilerplate scan.
7. Registry readiness vs mapped `/workflows/<name>/` operation status for all 27 workflows; conflict-declaration check on the one conflict found.
8. `query-registry.json` (162) and `command-registry.json` (173) — full id presence diff against `11-use-case-catalog.md`; classification and status recount; full field dump of all 17 blocked commands.
9. Platform owner coverage — 65 non-business operations diffed against the six `canonical-design/platform/*.md` documents.
10. Source reads for literal verification: `returnLifecycle.ts`, `quoteVersioning.ts`, `taskLifecycle.ts`, `supportCaseLifecycle.ts`, `evaluateEffectiveAccess.ts`, `accessGovernance.types.ts`, `recordOwnership.rules.ts`, `recordOwnership.types.ts`, `dealStages.ts`, `dealPipelineHealth.ts`, `money.ts`.
11. Transition-table census across `src/modules/*/domain/rules/` (found exactly 6).
12. `???` corruption census across `canonical-design/` and `design-reconstruction/`.
13. Money rounding/minor-unit search across the full OpenAPI document (schema extensions and operation descriptions) and `money.ts`.
14. `unresolved-decisions.json` — 23 entries; full read of `DEC-COMMAND-SEMANTICS` and `DEC-PLATFORM-CONNECTED-PROJECTIONS`.
15. Coverage ledger — 2,077 entries, classification sum, unclassified count, snapshot-vs-repository counter reconciliation against `analysis-state.json`.
16. Executed `npm run api:check` → **PASS**.
17. Executed `npm run repo:check` → **FAIL**; delta attributed file-by-file to the new namespaces.
18. Executed `npm run quality:gate -- --gate quality.backend-readiness` → **FAIL**; unregistered set enumerated and bucketed by namespace (114, none from `docs/` or `src/`).
19. `git status --porcelain --untracked-files=all` — 126 untracked, 0 tracked modified.
20. Baseline discipline — absence of `BASELINE.json` and `CANONICAL_BASELINE`; `RECONSTRUCTED_DRAFT` header present on all 73 canonical Markdown files.

## 7. Checks not executed, and why

| Check | Reason |
|---|---|
| Live provider conformance | No backend exists. This is `F-BLOCK-CONFORMANCE`, reclassified here as `IMPLEMENTATION_VALIDATION_PENDING`. Cannot be discharged by review. |
| Browser E2E | Requires a browser install and a running app; out of scope for design conformance. The frontend conformance report correctly marks the affected axes PARTIAL/NOT_VERIFIED rather than claiming them. |
| Full `npm run verify` | Stops at the backend-readiness gate, which was run directly instead — same failure, isolated at lower cost. Upstream gates are unaffected since no source was modified. |
| Line-by-line read of all 2,077 files | Prohibited by the token-economy rule and unnecessary — coverage is verified structurally (ledger sums, 0 unclassified) and semantically by targeted deep reads of the files the canonical claims depend on. |
| Request/response schema diff of the 236 ready operations | Out of scope: `contract-authority.md` assigns exact wire format to OpenAPI and the canonical design does not restate schemas, so there is no restatement to falsify. |

---

**READY_FOR_FINAL_BASELINE_REVIEW**
