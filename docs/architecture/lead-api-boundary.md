# Lead module API boundary

## Status

Lead is the reference implementation for module-owned API management. Phase 3 closed profile create/edit. Phase 4 closed the single-aggregate work-state, disqualification, and reopen commands. Phase 5 closes three distinct positive qualification workflow contracts without reintroducing a generic status mutation.

The production runtime follows:

```text
Lead presentation
  -> Lead application ports
  -> LeadHttpApiAdapter
  -> CommercialApiClient generated from OpenAPI
  -> platform HTTP client
```

## Owned application ports

Connected Kanban reads use `GET /leads/kanban/{column}` through a dedicated query port and generated client. Each column owns its bounded items, authorized totalCount, cursor, loading and error state. Loading more one column does not fetch all columns. The existing table uses ListLeads paging independently. Both paths retain workspace, effective record scope and field access; drag commands remain authoritative and invalidate the column windows after success.

`src/modules/leads/application/ports/LeadApiRuntime.ts` owns:

- `LeadQueryPort.list` and `LeadQueryPort.get`;
- `LeadCommandPort.createLead`;
- `LeadCommandPort.replaceLeadProfile`;
- `LeadCommandPort.advanceLeadWorkState`;
- `LeadCommandPort.disqualifyLead`;
- `LeadCommandPort.reopenDisqualifiedLead`;
- connected/demo/test runtime selection;
- application-owned inputs, authoritative results and mutation evidence.

Generated DTOs, transport errors, headers and OpenAPI types do not cross this boundary.

## Profile contract decision

Lead creation is not Customer creation. The former `CreateLeadRequest.customerId` requirement contradicted the Lead form and domain, so it was removed rather than filled with a guessed or synthetic Customer identifier.

`createLead` accepts a closed Lead profile write model. The backend owns Lead ID, timestamps, lifecycle state, score, version, audit evidence and interested-product read-model identifiers.

Profile editing uses `replaceLeadProfile`:

```text
PUT /leads/{leadId}
Idempotency-Key: required
If-Match: required
```

The operation fully replaces editable profile fields. Omitted optional profile fields are cleared. Lifecycle state, qualification result, identity resolution, score and audit metadata are not editable through this operation.

## Lifecycle contract decision

The active Lead progression remains separate from qualification outcome. Phase 4 adds three typed commands:

```text
POST /leads/{leadId}/advance-work-state
POST /leads/{leadId}/disqualify
POST /leads/{leadId}/reopen
```

All three require `Idempotency-Key` and `If-Match`, return authoritative `LeadMutationResponse`, and execute as one Lead-aggregate transaction. `advanceLeadWorkState` only accepts `CONTACTING` or `VERIFYING`; `CLOSED` is not a generic target. Verification profile values may be supplied atomically when entering `VERIFYING`.

Disqualification requires both a reason and evidence. Reopen is valid only for a Lead closed with the `DISQUALIFIED` outcome. Actor identity, activity IDs, timestamps, versions, command IDs and audit evidence are backend-owned and are not accepted in request bodies.

## Qualification workflow contracts

The generic `qualifyLead` operation is retired and remains blocked. Phase 5 introduces three dedicated backend-orchestrated operations:

```text
POST /workflows/lead-qualification/{leadId}/nurture
POST /workflows/lead-qualification/{leadId}/opportunity
POST /workflows/lead-qualification/{leadId}/direct-sale
```

Each operation has a closed outcome-specific request, requires `Idempotency-Key` and `If-Match`, and returns authoritative Lead/workflow evidence. The connected frontend requests exactly one workflow and never creates downstream aggregates or coordinates compensation.

- `NURTURE` owns relationship resolution, optional follow-up Task creation and Lead closure.
- `OPPORTUNITY` owns relationship resolution, Deal creation, optional follow-up Task creation and Lead closure.
- `DIRECT_SALE` owns relationship resolution, Quote or Order creation and Lead closure. The frontend sends decimal-string Money inputs using the workspace base currency; totals, tax, rounding, document numbers, downstream IDs and evidence remain backend-owned.

The dedicated workflow boundary lives under `src/workflows/lead-qualification/{application,infrastructure,runtime}`. Generated API types remain inside workflow infrastructure. Demo snapshot orchestration remains available only in demo mode.

## Connected implementation

`src/modules/leads/infrastructure/http` owns:

- `LeadHttpApiAdapter`: canonical module adapter and catalog owner;
- `LeadHttpQueryAdapter`: list/detail execution;
- `LeadHttpCommandAdapter`: profile and lifecycle commands;
- `LeadApiMapper`: application/DTO mapping and closed custom-field value mapping;
- `createLeadConnectedApiRuntime`: connected composition;
- `LeadModuleDataAuthorityBridge`: transitional query-only compatibility bridge.

The compatibility bridge never executes generic Lead mutations. Dedicated Lead commands are intentionally excluded from `RoutedHttpMutationAuthority` because the module adapter owns their semantics.

## Runtime behavior

- List and detail use `LeadQueryPort` directly.
- Create, edit and supported lifecycle actions await authoritative backend responses before updating the browser projection.
- Connected mode never falls back to browser persistence after HTTP failure.
- Every mutable Lead command sends the authoritative resource version through `If-Match`.
- Money is transported as decimal-string `Money`; the form supplies workspace currency.
- The generic qualification endpoint remains fail-closed; dedicated NURTURE, OPPORTUNITY and DIRECT_SALE commands use the workflow HTTP adapter.
- Bulk lifecycle helpers remain demo-only and throw `LEAD_BULK_LIFECYCLE_CONTRACT_BLOCKED` in connected mode until a backend batch contract exists.

## OpenAPI ownership

| Operation | Runtime status |
| --- | --- |
| `listLeads` | Connected through `LeadQueryPort` |
| `getLead` | Connected through `LeadQueryPort` |
| `createLead` | Connected through dedicated `LeadCommandPort` |
| `replaceLeadProfile` | Connected; idempotency and `If-Match` required |
| `advanceLeadWorkState` | Connected; typed progression command |
| `disqualifyLead` | Connected; reason/evidence required |
| `reopenDisqualifiedLead` | Connected; typed reopen command |
| `qualifyLeadForNurture` | Connected through dedicated workflow adapter |
| `qualifyLeadForOpportunity` | Connected through dedicated workflow adapter |
| `qualifyLeadForDirectSale` | Connected through dedicated workflow adapter |
| `qualifyLead` | Deprecated and contract-blocked |

## Permanent guard

`quality.lead-api-boundary` enforces:

- required ports, adapters and runtimes;
- no platform API or generic authority imports in restricted Lead layers;
- dedicated query hooks and command methods;
- catalog ownership by `LeadHttpApiAdapter`;
- closed request mapping, Money and typed custom fields;
- idempotency and concurrency propagation;
- authoritative mutation evidence validation;
- generic Lead mutation paths remaining fail-closed;
- qualification generated-client imports limited to workflow infrastructure;
- distinct qualification operation ownership, Money mapping and authoritative workflow evidence;
- connected bulk lifecycle helpers remaining blocked without a batch contract.

## O2 Claim boundary

`claimLeadFromQueue` now uses the generated canonical POST `/workflows/lead-queue/{leadId}/claim` with `{}`, Idempotency-Key and If-Match. The caller supplies no owner. The connected adapter has no demo fallback. Queue rows and counts come from backend `assignmentState=UNASSIGNED`; row version is carried into Claim without requiring a locally owned cache entry. Ambiguous network retries retain the original key and version. Claim does not change lifecycle or Tasks. Assign, bulk Assign and Handover remain connected unavailable.

## Canonical Lead Handover boundary

`handoverLeadWithTasks` uses generated POST `/workflows/lead-handover/{leadId}` and the closed `{ nextOwnerId, reason }` body. The adapter validates the authoritative envelope and all result fields, accepting numeric Task version 0. It never asserts the returned Task set against browser-visible IDs or calculates connected SLA.

The dedicated `useLeadHandover` hook retains the key, expected Lead version and full payload across ambiguous retry and same-Lead close/reopen; a changed record ID clears previous intent. New intent uses the newest authoritative prop/refresh version. A 412 keeps the dialog draft and requires explicit refresh. Exact ambiguous replay is allowed after target ownership is observed, under current resource capability authority without using transferred ownership as denial; new admission additionally requires writable ownerId.

Connected composition calls the real generated operation. Claim and single Assign remain available; Bulk Assign remains unavailable. Demo runtime independently discovers eligible retained Tasks and freezes due-at from workspace SLA. The permanent gate is `quality.lead-handover`; real-host SQL/recovery and browser acceptance are tracked separately.

## Connected table query authority

The connected table renders the authorized `listLeads` response without local search, filtering, deduplication or sorting. Existing backend ordering is `UpdatedAt DESC, LeadId DESC`; the UI labels it Recently updated. The existing transport accepts search, workState (NEW/CONTACTING/VERIFYING/CLOSED), ownerId and assignmentState. UNASSIGNED cannot be combined with ownerId. Search matches Lead ID/display name and readable primary phone search projections; browser code does not reproduce the SQL predicate. Page totals are exact counts of the authorized/filter predicate, separately read from bounded keyset pages; concurrent writes do not have a snapshot guarantee. The UI offers 25/50/100 rows, initially 50; backend validation permits 1–250.

`resolveConnectedLeadTableQuery` admits only complete intents. All, My Leads with trusted member identity, New, Contacting, Verifying, authorized Unassigned and custom saved views composed entirely of supported filters/ordering may execute. Contradictory view/filter combinations, TEAM scope, source/campaign/outcome/follow-up/duplicate filters, old createdAt/name/score/follow-up sorts and outcome-specific views show an explicit bilingual unavailable state. No partial request, fake empty table or full-collection fallback is used. Saved preferences remain intact; Return to All Leads resets the current selection without deleting a saved view. Local/demo filtering remains isolated.

The table uses the existing server-paged hook with full workspace/principal/membership/authority-revision and intent identity, and opts out of previous-page retention. Pending pages and errors cannot relabel old rows/counts; stale responses cannot apply. Selection is scoped to this identity and may span pages within the same query. Queue completions from a retired identity cannot notify/refresh current results. Backend command authorization, versions and idempotency remain authoritative. Table pages never populate a global Lead repository. Connected scope retirement evicts stale projections; local/demo query changes preserve their admitted local collection. Kanban retains independent column counts, cursors, cancellation, errors, retry and Load More; its scope identity also includes current authority revision. No API or migration is added.

Runtime regression coverage runs in the existing `quality.lead-handover` gate through `check-lead-list-confidentiality.mts` (including the server-authoritative table fixture), plus existing Lead scale, saved-view, ownership, queue and Kanban gates. These fixtures and frontend verification do not certify real connected Backend/SQL acceptance or production release readiness.

The earlier readiness findings L02 (search post-filter), L03 (workState/owner post-filter), L04 (unsupported partial-page filters), L05 (sort mismatch) and L28 (saved-view intent) are addressed in this bounded frontend implementation. L04's unsupported capabilities remain blocked by the missing backend/product contract; explicit unavailability fixes the misleading table without admitting those capabilities. L02/L03/L05/L28 have fixture proof and remain NOT_VERIFIED for real Backend–Frontend–SQL acceptance. This does not promote all Lead interactions to production READY.

## Lead tag mutation ownership

Both intents require an authoritative opening tag array; omitted or withheld tags cannot be interpreted as an empty collection. A known empty array remains writable. If current data, record/FLS access or operation availability prevents editing, the interaction retains an accessible unavailable surface and close path while suppressing protected tag data and refusing mutations. Recoverable drafts remain owned by their interaction.

Add and Remove are separate intents inside the opening Tags interaction. `useLeadTags` uses the existing dialog pending owner; global Save remains bound to Add. Remove acquires that same owner synchronously, awaits the canonical profile command, and acknowledges success only after the matching Lead/receipt confirms the requested tag set. No local timestamp, optimistic removal, or global collection simulation is used. Ordinary close/Escape/outside click and Save cannot retire or compete with a pending command; route/workspace/principal/membership/authority changes retire the Tags UI immediately. Retired completions cannot project, notify, close a new interaction, or clear its pending owner.

`replaceLeadTagsViaApi` submits the opening profile and observed version to the existing `replaceLeadProfile` command without a latest-resource read/rebase. A confirmed Remove result becomes the observation for a subsequent tag intent in the same interaction. Backend record authorization, current FLS write checks, serializable transaction, version check and actor/workspace-scoped idempotency remain authoritative. The HTTP adapter continues validating the command envelope. The tag boundary additionally validates target identity, receipt version/outcome and the full requested tag set before projection/invalidation.

Validation failures retain the draft and authorized tags. Denied or missing resources retire the protected interaction with a typed failure message. Conflict and ambiguous network/server outcomes block further tag replacement in that interaction; no automatic retry or new-key replay occurs. Close, authoritative refresh/reconciliation, and reopening create a new observation. This bounded repair does not introduce command-status reconciliation or claim that discarding a stale response rolls back a remote commit. All unrelated Lead profile writers and dialog authority remain outside this package.

The permanent Promise regression fixture runs inside `quality.crm-ui-interaction-contracts`, preserving its existing assertions. It exercises real React clicks/dialog ownership, deferred/rejected commands, receipt/target checks, opening versions, both Add/Remove directions, global unsaved-work Save/discard, Escape/outside click and route/workspace/principal/revision retirement. Frontend fixtures and source review do not establish real connected Backend–Frontend–SQL acceptance or production release attestation. The next separate package is Lead/Contact connected acceptance in a safely owned environment.
