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
