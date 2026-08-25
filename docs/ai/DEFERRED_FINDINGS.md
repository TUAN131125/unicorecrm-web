# Deferred Findings

Final dispositions. The M0–M12 roadmap is closed, so nothing here is deferred to a later
phase: every entry carries a final owner and a release impact.

Disposition vocabulary:

```text
RESOLVED_BY_M12
CONFIRMED_SAFE_CONTAINMENT
DOCUMENTED_PRODUCT_GAP
BACKEND_CONTRACT_BLOCKER
DATA_MIGRATION_BLOCKER
VALID_STATIC_ANALYSIS_LIMIT
FALSE_POSITIVE_CLOSED
```

---

## DF-01 — Historical synthetic Task refs

Source: M3 · Severity: Medium · Area: Deals / Tasks identity

Previously persisted `task_deal_*` references may remain in backend Deal records.

**Disposition: DATA_MIGRATION_BLOCKER.** Confirmed from the schema, not assumed.
`UpdateDealNextActionRequest` requires `nextActionAt` and makes `taskId` optional, with no
documented meaning for omission and no null form on `EntityId`. Omitting `taskId` may mean
"leave unchanged" or "clear"; the contract does not say, and `DealNextActionRef.id` has no
clear operation of its own. A frontend cleanup pass would be guessing at write semantics.

New writes are correct (see M3, and the negative control `MA-03-task-identity`). Historical
records are a separate, backend-owned question.

Owner: BACKEND / DATA_MIGRATION · Connected behavior: SUPPORTED for new writes ·
Release impact: NON_BLOCKING_PRODUCT_GAP if release policy accepts a separate migration.

---

## DF-02 — Deal ↔ Task authoritative next-action linking

Source: M3 · Severity: Medium · Area: Deals / Tasks

**Disposition: BACKEND_CONTRACT_BLOCKER.** A connected Deal may carry no authoritative Task
reference because the only mechanism that would create one is WF-21 work-activation, which is
BLOCKED and coordinator-forbidden. `deal.update-next-action` accepts a `taskId` but the
frontend may not mint one, and no backend operation commits the Deal update and the Task
together.

Owner: BACKEND · Connected behavior: FAIL_CLOSED (plain Deal creation still works; only
Deal-plus-follow-up is refused) · Release impact: NON_BLOCKING_PRODUCT_GAP.

---

## DF-03 — AI Task identity test weakness

**Disposition: FALSE_POSITIVE_CLOSED — resolved in M11.** The assertions now locate the Task
by the markers activation actually persists, with a positive control proving the finder
works. Negative control `DF-03-ai-task-identity` fails the gate. Re-verified in M12.

Owner: none · Release impact: none.

---

## DF-04 — Client-generated Deal IDs

Source: M3 · Severity: Unknown · Area: Contacts / Deals

**Disposition: FALSE_POSITIVE_CLOSED — audited in M12, no defect.** The audit was structural
and covered all 20 create-shaped commands, not only Deals:

- Every create request schema in OpenAPI declares `additionalProperties: false` and exposes
  no property naming its own aggregate. `CreateDealRequest` has no `dealId`.
- `mapCreateDealRequest` maps named canonical fields only; the caller's `deal.id` is never
  forwarded.
- Client-side values come from `createCreateCommandTarget`, which produces `pending_<type>_
  <uuid>` — self-describing provisional identity used for the idempotency/metadata key.
- `FetchHttpClient` validates every outgoing body against the OpenAPI schema and throws
  `CONTRACT_VIOLATION`, so a client aggregate id could not reach the backend even if a mapper
  tried to send one.

Classification: **CLIENT_INTENT_ID_ONLY**, with **SERVER_ASSIGNED_AGGREGATE_ID** for every
audited aggregate.

Minor observation, not a defect: `isProvisionalIdentity` in `src/shared/ids/index.ts` is
exported but unused.

Owner: none · Release impact: none.

---

## DF-05 — Order closing workflow adapter gap

Source: M4 · Severity: High · Area: Orders / workflow dispatch

**Disposition: BACKEND_CONTRACT_BLOCKER.** M12 re-audited this from source as a mandatory
first-class review, and the evidence is sharper than M4 recorded.

Everything a dedicated connected workflow adapter needs already exists:

```text
CMD-046 order.complete-from-fulfillment-evidence   PRODUCTION_CONTRACT_READY
OpenAPI  POST /workflows/order-closing/{orderId}/complete-from-fulfillment-evidence
         EmptyCommandRequest -> OrderMutationResponse
         IdempotencyKey + If-Match, per-order (RESOURCE scope, MUST_MATCH_TARGET)
client   CommercialApiClient.completeOrderFromFulfillmentEvidence (generated, versioned)
```

The blocker is not the command. It is that **the canonical records disagree**: the workflow
that owns the command, WF-12 order-closing, is `contractReadiness: BLOCKED`,
`connectedFrontendCoordinatorAllowed: false`, blocked on `DEC-WORKFLOW-ORDER-CLOSING`. That
decision exists nowhere in the repository — which is the uniform marker of an unmade
decision here: every `DEC-WORKFLOW-*` id is referenced only by `workflow-ownership.json`,
while resolved decision ids (`DEC-P02-…`, `DEC-PHASE5-…`) carry records elsewhere.

`runtimeImplementationMode: DEDICATED_WORKFLOW_HTTP_ADAPTER` requires dispatch through the
workflow, so a ready command inside a blocked workflow is not usable. Compare WF-10
lead-qualification, which is `PRODUCTION_CONTRACT_READY` at both levels and therefore does
own a real adapter (`LeadQualificationHttpAdapter`).

Deciding which canonical record wins is a backend/product ownership decision. The frontend
must not pick a winner by shipping an adapter, so no adapter was written.

**Post-M12 re-audit: the conflict is formally registered, and still unresolved.** An
exhaustive search found it recorded three times, all in `design-reconstruction/`:

```text
CON-007  workflow-ownership WF-12 says BLOCKED vs OpenAPI READY
         resolution: "OpenAPI controls HTTP transport; workflow registry readiness
         needs owner reconciliation."
R2-02    NON_BLOCKING_DESIGN_DEBT, "recorded, not reconciled"
         required action: reconcile the registry field under docs/ write authority
         owner: Repository Governance Owner + API Contract Architect
contract-reconciliation.md: the single CONFLICT row across all 27 workflows
```

That corpus cannot resolve it. `design-reconstruction/README.md` declares
**`Status: NON_AUTHORITATIVE`** and states that implementers "must not use it to invent
missing requirements" — which is exactly what adopting its "the registry field is stale"
reading would be. Its own CON-007 resolution defers to an owner rather than deciding.

Inside the authoritative `docs/` tree there is no resolution at all: no ADR
(`ADR-001`…`ADR-006` say nothing about order closing), no decision record, and no statement
that WF-12 is ready. `docs/architecture/module-ownership-and-workflows.md` describes the
workflow's semantics — "evaluates owner evidence and decides whether a confirmed Order may
complete" — without touching readiness.

Two authoritative sources therefore remain in direct conflict:

```text
docs/api/README.md          OpenAPI is "the sole production HTTP contract authority";
                            completeOrderFromFulfillmentEvidence is READY, no blocking id
docs/backend-readiness/     CMD-046 PRODUCTION_CONTRACT_READY
  command-registry.json
docs/backend-readiness/     WF-12 contractReadiness BLOCKED,
  workflow-ownership.json   blockingDecisionId DEC-WORKFLOW-ORDER-CLOSING
```

Note what is *not* in conflict: `connectedFrontendCoordinatorAllowed: false` is untouched by
OpenAPI, which has no such field. On its own that flag would not block implementation —
WF-11 order-cancellation carries the same flag, is READY, and is connected-implemented as a
single authoritative command. The blocker is the workflow's **readiness** field alone.

**Required decision, for the named owners:**

```text
Option 1  WF-12 becomes production-ready and owns the operation.
          Then clarify: per-order vs batch semantics; blocker result semantics
          (ORDER_COMPLETION_BLOCKED / FULFILLMENT_EVIDENCE_REQUIRED / PAYMENT_GATE_BLOCKED);
          whether auditEvidenceIds is the closing evidence identity; transaction boundary.
Option 2  WF-12 remains blocked.
          Then correct CMD-046 readiness and runtimeImplementationMode to match, so the
          command registry stops advertising a dispatch route that may not be taken.
```

A second, independent gap survives either option: the frontend boundary accepts `orderIds[]`
while the operation is per-order, and no canonical batch or partial-completion semantics
exist for order closing. Fanning out with `Promise.all` was deliberately not done — that
would move an undefined product semantic into frontend orchestration.

M12 did change containment quality: WF-12 now declares its own connected unavailability and
refuses on WF-12 (`CONNECTED_WORKFLOW_COORDINATOR_FORBIDDEN`, `workflowId: WF-12`) at the
workflow boundary and at all three presentation entry points, instead of failing on a
command-dispatch diagnostic. Proven by execution: zero HTTP calls, zero evidence writes.

Owner: BACKEND / ARCHITECTURE_DECISION · Connected behavior: FAIL_CLOSED ·
Release impact: **BLOCKER** — order closing is not product-complete.

---

## DF-06 — Order-closing frontend coordinator

Source: M4 · Severity: Medium · Area: Orders

**Disposition: CONFIRMED_SAFE_CONTAINMENT.** Demo/local `executeOrderClosing` still
coordinates payment/shipping/evidence locally, and evaluates the closing policy and mints
`pe_order_*` evidence ids in the browser. That is demo-owned behaviour and stays.

It cannot become connected authority: every connected `orderClosing` write port binds through
`unavailableConnectedOperation(ORDER_CLOSING_OPERATION)`, and the boundary refuses on WF-12
before the local executor is reached.

If DF-05 is unblocked, the backend command must be routed to; this local coordinator must not
have its containment lifted.

Owner: ARCHITECTURE_DECISION (with DF-05) · Connected behavior: FAIL_CLOSED ·
Release impact: KNOWN_LIMITATION.

---

## DF-07 — Blocked/unavailable UX

**Disposition: FALSE_POSITIVE_CLOSED — resolved in M10.** Remaining affordance gaps are
[[DF-26]].

---

## DF-08 — Receivable collection activity ownership

Source: M5 · Severity: Medium · Area: Invoices / Receivables

**Disposition: DOCUMENTED_PRODUCT_GAP.** Confirmed exhaustively in M12: the receivables
surface is read-only in the contract. OpenAPI publishes `listReceivables`,
`getReceivablesAging`, `getReceivablesSummary` and `getBuyerAccountStatement`, all
PRODUCTION_CONTRACT_READY, and **no write operation of any kind** for collection activity,
promise-to-pay, statement-sent or collection completion. No command in the registry owns it.

This is the same MA-01 shape as [[DF-10]] — an authoritative backend read with no
authoritative write — and it is already contained: "Receivable collection activity save" and
"…state update" are declared unavailable by the connected composition and the ports fail
closed, proven by `quality.connected-unavailable-port-containment`.

Owner: PRODUCT / BACKEND · Connected behavior: READ_ONLY ·
Release impact: NON_BLOCKING_PRODUCT_GAP.

---

## DF-09 — Connected Studio configuration

Source: M5 · Severity: High · Area: Studio

**Disposition: DOCUMENTED_PRODUCT_GAP, and the earlier description was too broad.** M12
separated what is actually blocked from what is implemented.

Connected and working — READY commands with dedicated adapters, routed through
`studioCoreRuntime`, with the browser path fail-closed via `assertDemoMutation`:

```text
studio.update-business-information   studio.update-locale-region
studio.update-blueprint              studio.update-features
studio.publish-configuration         studio.quick-setup.{open,dismiss,complete-step,skip-step}
```

Blocked, and correctly refused with safe copy:

```text
invoice seller information       payment receiving configuration
CRM pipelines / deal stages      product types / product configuration
```

So the connected Studio is **not** "largely read-only": its workspace-configuration core is
connected-implemented, and a specific set of domain configuration writes has no contract.

Owner: PRODUCT / BACKEND · Connected behavior: partially SUPPORTED, the rest FAIL_CLOSED ·
Release impact: NON_BLOCKING_PRODUCT_GAP.

---

## DF-10 — Platform configuration local persistence

Source: M5 · Severity: Medium → **High once diagnosed** · Area: Platform configuration

**Disposition: RESOLVED_BY_M12.** M5 recorded this as "may persist outside module connected
authority". It did, and it was a live MA-01 violation.

`saveIntegrationConnection`, `verifyIntegrationConnection`,
`disconnectIntegrationConnection`, `saveDeveloperWebhooks` and `saveCrmObjectSchemas` were
backed by `BrowserStorageAdapter` repositories with **no runtime-mode awareness at all** —
they wrote to browser storage in connected mode exactly as in demo mode. Meanwhile the
corresponding reads are authoritative:

```text
listIntegrationConnections   PRODUCTION_CONTRACT_READY
listCrmObjectSchemas         PRODUCTION_CONTRACT_READY
createIntegrationConnection / updateIntegrationConnection / disconnect / verify   BLOCKED
createCrmObjectField / updateCrmObjectField / deleteCrmObjectField                BLOCKED
webhooks                     no OpenAPI operation in either direction
```

A backend read paired with a browser write, presented as workspace configuration, is exactly
what MA-01 forbids. Unlike a module business port there was no connected binding to fail
closed, so nothing else in the system would have caught it. Integration **credential
references** were among the values being written.

Fix, following the M5/M6 mechanism: `src/platform/connected-configuration/
connectedConfigurationAvailability.ts` owns the operation labels and predicates; the connected
composition declares them before the service bundle is built; each runtime asserts before it
touches its repository; each Studio view refuses first with `unavailableFeatureMessage`.

Proven by execution: all five writes refuse with `CONNECTED_OPERATION_REQUIRES_BACKEND`,
state byte-identical, zero HTTP calls, safe user copy, internal diagnostic preserved. Demo
mode declares nothing and all five writes still succeed.

Gated by `quality.connected-platform-configuration-authority`, which derives the rule from
OpenAPI in both directions: if any of these write operations becomes READY, the gate fails
and forces real routing rather than letting a refusal outlive its blocker.

Owner: none (frontend closed); PRODUCT/BACKEND still own the missing write contracts ·
Release impact: none for the invariant; the missing contracts remain part of [[DF-09]].

---

## DF-11 — Projection gate coverage

**Disposition: FALSE_POSITIVE_CLOSED — resolved in M11.** Negative control
`MA-04-post-commit-projection` fails the gate. M12 additionally proved the gate catches a
post-commit write hidden one call deep inside a local helper.

---

## DF-12 — Deal timeline activity read-model gap

Source: M2 · Severity: Medium · Area: Deals read model

**Disposition: DOCUMENTED_PRODUCT_GAP (EVENTUAL_BACKEND_PROJECTION).** `DealReadModel`
declares an `activities` array, so the read model has a place for Task activity; whether the
backend projects Task activity into it is backend behaviour this repository cannot execute or
assert.

What M12 can assert is the frontend half: no presentation code fabricates Deal activities to
fill the gap. `quality.post-commit-projection-writes` proves no post-commit local projection
write exists, including through a helper.

Classification: **EVENTUAL_BACKEND_PROJECTION**, with **LOCAL_FABRICATION_FORBIDDEN** enforced.

Owner: BACKEND · Connected behavior: DEGRADED (timeline may be incomplete, never false) ·
Release impact: NON_BLOCKING_PRODUCT_GAP.

---

## DF-13 — Quote → Deal timeline gap

Source: M2 · Severity: Low · Area: Quotes / Deals read model

**Disposition: DOCUMENTED_PRODUCT_GAP (EVENTUAL_BACKEND_PROJECTION).** Same shape and same
frontend guarantee as [[DF-12]]. Quote acceptance is authoritative
(`quote.accept-and-close-deal`, READY); whether it projects Deal timeline activity is a
backend read-model question.

Owner: BACKEND · Release impact: NON_BLOCKING_PRODUCT_GAP.

---

## DF-14 — Blocked coordinator-forbidden workflows without a workflow-owned refusal

Source: M6 · Severity: Medium · Area: Connected workflow composition

**Disposition: RESOLVED_BY_M12.** WF-05 (customer-conversion), WF-09 (deal-recycle) and
WF-12 (order-closing) each now bind through `unavailableConnectedOperation` with their own
operation constant, expose their own availability predicate, and assert at the workflow
boundary before any command.

`quality.workflow-coordinator-ownership` now reports 27 coordinator-forbidden workflows, 4
blocked and connected-bound, **4 of 4 declaring their own connected unavailability, 0
pinned**. The `awaitingWorkflowOwnedDeclaration` list is empty and compared exactly in both
directions. Negative control `MA-06-wf12-declaration` reverts every WF-12 declaration and the
gate fails.

Note on the gate's scope, recorded honestly: it checks the coordinator-forbidden workflows
that the connected composition *binds* (5 of 27). The others have no ports. WF-02
contact-organization is the notable one — it derives its predicate from canonical command
status (`isMutationCommandUnavailable("contact-organization.upsert-relationship")`) rather
than from the composition registry, which for a canonically BLOCKED command is a stronger
derivation, not a weaker one.

Owner: none · Release impact: none.

---

## DF-15 — Two divergent WF-01 implementations

Source: M6 · Severity: Medium · Area: Contacts presentation

**Disposition: CONFIRMED_SAFE_CONTAINMENT.** `useContactDetailController.handleCreateOpportunity`
enters WF-01 through the workflow boundary; `useContactListController.handleCommitOpportunity`
implements the same intent inline. Both refuse on the WF-01 predicate before any mutation, so
connected mode performs zero writes, and `quality.workflow-coordinator-ownership` pins the
caller inventory exactly so a third entry point cannot appear unreviewed.

Consolidation remains desirable and was not done: it is a refactor of demo-mode code paths
with no effect on connected authority, and M12 deliberately did not start refactors that
change no invariant.

Owner: ARCHITECTURE_DECISION · Connected behavior: FAIL_CLOSED ·
Release impact: KNOWN_LIMITATION.

---

## DF-16 — Follow-up Task creation nested inside WF-01 handlers

Source: M6 · Severity: Low · Area: Contacts presentation / Tasks

**Disposition: CONFIRMED_SAFE_CONTAINMENT.** Unreachable in connected mode — the parent WF-01
handlers refuse first. Still two implementations of one business step; consolidating onto the
WF-21 boundary is the same refactor as [[DF-15]].

Owner: ARCHITECTURE_DECISION · Release impact: KNOWN_LIMITATION.

---

## DF-17 — Memory documents were unregistered in repository contracts

**Disposition: FALSE_POSITIVE_CLOSED — resolved in M6.**

---

## DF-18 — WF-04 demo coordinator remains a frontend Deal→Task sequence

Source: M7 · Severity: Medium · Area: Customer commercial actions

**Disposition: CONFIRMED_SAFE_CONTAINMENT.** `createDealForCustomer` still sequences
`deal.create` then `task.create` in demo mode. Connected mode refuses on WF-04 at the
coordinator and at its single caller; negative controls `MA-06-wf04-declaration` and the M12
alias shape both fail the gate. If a backend WF-04 operation lands, the workflow must route to
it rather than have containment lifted.

Owner: ARCHITECTURE_DECISION (with the WF-04 contract) · Connected behavior: FAIL_CLOSED ·
Release impact: KNOWN_LIMITATION.

---

## DF-19 — WF-04 Deal→Task non-atomicity is unresolved, not fixed

Source: M7 · Severity: Medium · Area: Customer commercial actions / partial commit

**Disposition: BACKEND_CONTRACT_BLOCKER.** There is no connected partial commit today because
WF-04 is contained, but the semantics are unowned. `compensationOwner` is BACKEND and no
frontend compensation exists anywhere, by design. If a backend WF-04 operation lands, partial
outcomes must be backend-reported, never reconstructed in the frontend.

Owner: BACKEND · Connected behavior: FAIL_CLOSED · Release impact: NON_BLOCKING_PRODUCT_GAP.

---

## DF-20 — Connected composition must not import workflow barrels

**Disposition: FALSE_POSITIVE_CLOSED — resolved in M11** by
`quality.composition-presentation-dependency`. Residual barrel coupling is [[DF-27]].

---

## DF-21 — Deal edit issues five authoritative commands in sequence

**Disposition: FALSE_POSITIVE_CLOSED — resolved in M9.**

---

## DF-22 — Lead call follow-up logs an activity then creates a Task

**Disposition: FALSE_POSITIVE_CLOSED — resolved in M9.**

---

## DF-23 — Customer bulk archive fans out through Promise.all

Source: M9 · Severity: Medium · Area: Customers presentation / bulk

**Disposition: CONFIRMED_SAFE_CONTAINMENT.** Unreachable: `customer.archive` is BLOCKED and
the handler refuses before dispatch. Pinned in `quality.partial-commit-outcomes` as
`containedBulkFanOut`. When `customer.archive` gains a contract this must become per-item
settlement through `summarizeBulkCommits` **before** containment is lifted.

Owner: BACKEND (with the `customer.archive` contract) · Connected behavior: FAIL_CLOSED ·
Release impact: KNOWN_LIMITATION.

---

## DF-24 — Partial-commit reporting is not verified at the React caller

**Disposition: FALSE_POSITIVE_CLOSED — resolved in M11.** Remaining limit is [[DF-28]].

---

## DF-25 — Safe copy is proven at the formatter, not at each surface

**Disposition: FALSE_POSITIVE_CLOSED — resolved in M11**, and hardened again in M12: the scan
now follows two bounded aliasing forms, so passing the catch binding into an inline formatter
no longer hides the read. Negative control `MA-08-inline-formatter-alias`.

---

## DF-26 — Some unavailable actions still refuse only after the click

Source: M10 · Severity: Low · Area: Presentation

**Disposition: CONFIRMED_SAFE_CONTAINMENT.** M12 narrowed the gap rather than closing it. The
three order-closing entry points now refuse *before* dispatch with safe copy rather than
throwing out of a click handler, and the three Studio configuration views added in M12 refuse
before their write. Several Contact/Customer/Deal/Order actions remain visually enabled and
refuse on click.

The refusal is correct and safe everywhere — preflight and boundary assertion both hold. What
remains is affordance: threading availability into shared action components is a
presentation-wide refactor that changes no invariant.

Owner: PRODUCT / ARCHITECTURE_DECISION · Connected behavior: FAIL_CLOSED ·
Release impact: KNOWN_LIMITATION.

---

## DF-27 — Barrels publish components alongside the contracts non-UI code must import

Source: M11 · Severity: Low · Area: Module boundaries / bundling

**Disposition: VALID_STATIC_ANALYSIS_LIMIT / KNOWN_LIMITATION.** Two reviewed exceptions
remain pinned in `quality.composition-presentation-dependency`
(`demoApplicationServiceBundle.ts`, and `paymentPlanCommands.ts` reaching
`@/platform/access-control` through the entry point `check-architecture.mjs` requires it to
use). Neither is a reachable defect; the connected composition is clean.

M12 added no new coupling: the new connected-configuration module is a leaf that imports only
`@/shared/application`, and the composition imports the constant list from that leaf rather
than from a platform barrel — deliberately, because those barrels export React hooks.

Owner: ARCHITECTURE_DECISION · Release impact: KNOWN_LIMITATION.

---

## DF-28 — Partial-commit reporting is executed at one controller only

Source: M11 · Severity: Low · Area: Quality gates

**Disposition: VALID_STATIC_ANALYSIS_LIMIT.** `quality.partial-commit-controller-runtime`
executes the Lead call flow end to end; the Deal edit and Order bulk-cancel flows are proven
structurally and by pinned classification, but no test renders them. Closing this needs a
seeded connected-mode controller harness — test infrastructure, not a gate change.

Residual risk is bounded: the structural gate fails on a dead outcome branch and on dropped
committed evidence, which are the two regressions DF-24 was written about, and M12 confirmed
both controls still fail the gate.

Owner: ARCHITECTURE_DECISION · Release impact: KNOWN_LIMITATION.

---

## DF-29 — Contact, Customer and Organization have no production write contract

Source: **M12** · Severity: High · Area: Contacts / Customers / Organizations

**Disposition: DOCUMENTED_PRODUCT_GAP.** Found by the M12 module reconciliation and not
recorded by any earlier phase.

The three CRM relationship modules own **zero** production-ready write commands. Every write
operation in OpenAPI is BLOCKED, while every read is READY:

```text
POST   /contacts                                          createContact               BLOCKED
PATCH  /contacts/{contactId}                              updateContact               BLOCKED
POST   /organizations                                     createOrganization          BLOCKED
PATCH  /organizations/{organizationId}                    updateOrganization          BLOCKED
PUT    /organizations/{id}/contacts/{contactId}           linkContactToOrganization   BLOCKED
PATCH  /customers/{customerId}                            updateCustomerLifecycle     BLOCKED
POST   /customers/{customerId}/complete-onboarding        completeCustomerOnboarding  BLOCKED

GET    contacts / customers / organizations (9 operations)  all PRODUCTION_CONTRACT_READY
```

Registry view: contacts 0 ready / 6 blocked, customers 0 ready / 3 blocked, organizations
0 ready / 3 blocked.

**Post-M12 re-audit narrowed this to two concrete, authoritative blockers.** The 20 CRM write
capabilities split cleanly, and none is implementable:

**(a) BLOCKED_CANONICALLY — 8 operations, all on ONE decision.** Every core CRM write is
blocked by `DEC-MUTATION-RESULT-PROJECTION`, the single largest blocking group in the whole
contract (8 of 34 blocked operations). It is recorded authoritatively in
`docs/backend-readiness/unresolved-decisions.json` with `status: BLOCKED`,
`recommendedOwner: contacts`, question *"Approve, redesign or retire OpenAPI operation
createContact"*, and these `blockingOperations`:

```text
createContact              updateContact
createOrganization         updateOrganization
linkContactToOrganization  updateCustomerLifecycle
completeCustomerOnboarding onboardExistingCustomer
```

Resolving that one decision unblocks the entire core CRM write surface.

**(b) NO_BACKEND_CONTRACT — 12 commands with no OpenAPI operation at all.** Each carries its
own `DEC-CMD-*` decision id that is recorded **nowhere** — the same dangling-marker pattern as
`DEC-WORKFLOW-*`, so the decision has not been made:

```text
contact.archive / restore / anonymize                DEC-CMD-CONTACT-*
organization.archive / restore / anonymize           DEC-CMD-ORGANIZATION-*
customer.archive / anonymize                         DEC-CMD-CUSTOMER-*
customer-conversion.reconcile                        DEC-CMD-CUSTOMER-CONVERSION-RECONCILE
contact-organization.upsert-relationship             DEC-CMD-CONTACT-ORGANIZATION-*
contact-organization.end-relationship
contact-organization.set-primary-representative
```

**READY_AND_IMPLEMENTABLE: 0.** Nothing was implemented, and no browser fallback was added.

**Minimum release write-set: PRODUCT_DECISION_REQUIRED.** No document in this repository
defines which CRM write capabilities are mandatory for release, so the frontend cannot decide
release scope. That determination belongs to product, alongside decision (a).

The frontend is correct and safe. Local writes go through connected projection repositories
whose `assertBackendProjectionWrite` refuses any write outside a backend-projection scope —
verified by execution: a connected Contact/evidence write raises
`ConnectedProjectionWriteError`, persists nothing and makes no HTTP call. MA-01 and MA-02 both
hold.

But containment is not completeness. In connected mode a user cannot create or edit a Contact,
create or edit an Organization, link a Contact to an Organization, or advance a Customer
lifecycle. That is the CRM core.

Related: [[DF-30]] records that this containment is projection-owned rather than
preflight-owned, so the refusal arrives after the click.

Owner: PRODUCT / BACKEND · Connected behavior: READ_ONLY ·
Release impact: **BLOCKER** — the product is not shippable as a CRM without these contracts,
even though the frontend architecture is sound.

---

## DF-30 — CRM write containment is projection-owned, not preflight-owned

Source: **M12** · Severity: Low · Area: Contacts / Customers / Organizations presentation

**Disposition: CONFIRMED_SAFE_CONTAINMENT.** The [[DF-29]] writes are contained by
`assertBackendProjectionWrite` inside the connected projection repositories rather than by a
module availability predicate consulted before the action. Nothing is ever persisted and no
HTTP call is made, so the invariant holds; but the user reaches the write and is refused
afterwards, and the refusal is inherited from projection infrastructure rather than owned by
the module.

This is the same shape M6 closed for WF-01 at the workflow level, one layer down. M12 did not
extend the availability-declaration mechanism to plain module CRUD, because doing so would
mean declaring roughly a dozen module operations whose blocked status is already canonical and
already enforced — a change with no invariant effect while [[DF-29]] is open. If the write
contracts land, this becomes moot; if they do not, it is the natural next containment
improvement.

Related: [[DF-26]] is the same affordance concern for actions that already have predicates.

Owner: ARCHITECTURE_DECISION · Connected behavior: FAIL_CLOSED ·
Release impact: KNOWN_LIMITATION.

---

## DF-31 — WF-07 customer onboarding mints evidence identity in the browser

Source: **M12** · Severity: Low · Area: Customer onboarding / commercial evidence

**Disposition: CONFIRMED_SAFE_CONTAINMENT.** `onboardExistingCustomerWorkflow` generates
`purchase_evidence_${crypto.randomUUID()}` and calls `recordCommercialEvidence` before it
reaches the WF-05 reconciliation that fails closed. The ordering looked like an MA-01/MA-03
hazard — a client-minted evidence id written locally, then a refusal.

Executed rather than reasoned about: in connected mode the write raises
`ConnectedProjectionWriteError` at `assertBackendProjectionWrite`, persists nothing and makes
no HTTP call, so the client-minted id never becomes state. `customer.onboard-existing` is in
no command registry and `onboardExistingCustomer` is BLOCKED in OpenAPI.

Commercial evidence has no connected backend adapter at all: `createCommercialEvidence()`
takes no HTTP client, so in connected mode the projection is empty and write-refused. It is a
demo-owned store.

Owner: PRODUCT / BACKEND (with the customer-onboarding contract) ·
Connected behavior: FAIL_CLOSED · Release impact: NON_BLOCKING_PRODUCT_GAP.
