# Lead Ownership & Distribution V1 — Backend Readiness Decision

Status: **TARGET**

Decision ID: `DEC-LEAD-OWNERSHIP-DISTRIBUTION-V1`

Business authority: `docs/business/lead-ownership-and-distribution-v1.md`

Reviewed frontend baseline: `unicorecrm-web@1c0f02510510bccb01078c0cb8d6410a274154f6`  
Reviewed backend baseline: `unicorecrm-backend@161a580417f05471c6f5c7a3faf1c95114f212f1`

## Decision

UniCoreCRM adopts a real unassigned Lead state.

```text
UNASSIGNED <=> ownerId == null
ASSIGNED   <=> ownerId references an authoritative assignable workspace member
```

External Lead ingress enters the unassigned Sales Queue. Interactive CRM creation by a salesperson remains assigned to the authenticated creator.

Sales Queue is a filtered Lead query, not an aggregate or fake owner.

## Operation semantics

| Operation | Target ownership | Task effect | Workflow ownership |
| --- | --- | --- | --- |
| Claim | null -> authenticated actor | none | Lead owner command / single authoritative transaction |
| Assign | current/null -> target member | none | Lead owner command / single authoritative transaction |
| Handover | current -> target member | eligible open Task snapshot; mandatory NORMAL takeover Task | backend-orchestrated cross-module workflow |
| Bulk Assign | versioned Lead set -> target member | none | authoritative backend batch |
| Bulk Handover | not admitted in V1 | n/a | out of scope |

## Target transport shapes

These shapes are target decisions, not proof of admitted backend routes.

### List unassigned

Preferred extension:

```http
GET /leads?assignmentState=UNASSIGNED
```

Do not encode unassigned through a sentinel `ownerId`.

### Claim

Preferred operation:

```http
POST /leads/{leadId}/claim
Idempotency-Key: required
If-Match: required
```

Request body SHOULD NOT accept `ownerId`.

Authenticated actor is the target owner.

Expected conflict:

```text
LEAD_QUEUE_CLAIM_CONFLICT
```

### Assign

Preferred operation:

```http
POST /leads/{leadId}/assign
Idempotency-Key: required
If-Match: required
```

Body:

```json
{
  "ownerId": "member_x",
  "reason": "Territory reassignment"
}
```

### Handover

Frozen O4 canonical operation: `POST /workflows/lead-handover/{leadId}`, operation ID `handoverLeadWithTasks`. Require If-Match, Idempotency-Key, X-Request-Id and X-Correlation-Id. The closed body is `{ nextOwnerId, reason }`; reason is trimmed and capped at 1000. No public Task targets or Task versions.

`leads.assign` and writable Lead owner field are required for new admission. Admission requires `tasks.create` and `tasks.assign` and authority over the complete eligible snapshot. The Lead record authority is `lead.assign-owner`. Completed exact replay requires current command capabilities and visibility of the Task proof fields in the receipt, without post-transfer Lead or Task ownership admission.

The response is a durable command receipt: the existing aggregate/version envelope plus reassigned IDs, takeover Task ID, numeric nonnegative Task version (native create starts at 0), ISO due-at and resolved SLA hours. It contains no LeadDocument or Task policy. Lead and Task queries are invalidated after success; the current Lead read model is reacquired through GET with current read authority.

### Bulk Assign

Preferred:

```http
POST /leads/assign-owner-batch
```

with a versioned Lead set, target owner, reason, and one idempotency boundary.

## Required backend domain changes

At the reviewed backend baseline:

```text
LeadProfile.OwnerId      non-null
Lead.ScopeOwnerId        non-null
Delegated ingress owner  bound to delegated subject
List filter              ownerId only
```

V1 requires:

```text
LeadProfile.OwnerId      nullable or equivalent explicit assignment model
ScopeOwnerId             nullable/queue-aware projection
Delegated external ingress -> no owner
List query               explicit assignmentState filter
```

No fake member is allowed as a migration shortcut.

## Access-control decision

Queue read/Claim must be explicit command/data-scope authority.

A member may be allowed to Claim without being allowed to Assign other people's Leads.

Recommended capability:

```text
leads.claim
```

If the capability catalog does not add it, the backend must still expose an explicit operation-level command decision. `leads.update` alone is not sufficient authority.

`leads.assign` remains the assignment authority.

Handover additionally requires backend workflow authorization across the Lead and Task participant boundaries.

## Handover Task scope

Eligible Task:

```text
status = OPEN
archivedAt = null
recordRef.moduleKey = "leads"
recordRef.recordId = leadId
```

Ineligible:

```text
COMPLETED
CANCELLED
other recordRef
same relationship only
Activity
```

## Transaction semantics

Claim and Assign are single authoritative Lead ownership transactions.

Handover uses a durable Atomic Workflow with participant-local transactions and an exact Lead reservation. The Tasks participant discovers and transfers its authoritative eligible Task snapshot inside one transaction, and creates exactly one NORMAL takeover Task. Recovery after Tasks commit completes Lead ownership without compensating Tasks or duplicating takeover work.

The frontend is never the coordinator.

No successful terminal Handover may leave a silent partial Lead/Task state.

## Idempotency and concurrency

- Claim: Lead ID + idempotency key + authoritative resource version.
- Assign: Lead ID + idempotency key + authoritative resource version.
- Handover: workflow-level idempotency covering Lead and eligible Task participants.
- Bulk Assign: versioned Lead set + one backend batch idempotency boundary.

Claim races admit exactly one winner.

## Audit evidence

Required business evidence:

```text
LEAD_CLAIMED
LEAD_ASSIGNED
LEAD_HANDOVER_COMPLETED
```

with trusted actor/workspace/time/correlation data.

Assign/Handover must persist reason.

Claim does not require a user-entered reason.

## Current repository verification warning

The frontend repository's generated OpenAPI/backend-readiness files contain Claim/Assign/Handover-shaped operations and some registries mark them READY.

The reviewed backend baseline does **not** map those operations in `LeadsEndpoints.cs`.

Therefore:

```text
contract-shaped != backend-implemented
READY inventory != verified route admission
generated client != executable connected capability
```

Connected composition must remain fail-closed until the backend host implementation is verified.

## Patch admission

Implement in order:

```text
O1 Assignment foundation
O2 Queue + Claim
O3 Assign
O4 Handover
O5 Frontend consolidation
O6 Bulk Assign
O7 Connected E2E hardening
```

Do not enable an operation before the corresponding backend patch is admitted and verified.

## Unresolved decisions

HO-SLA-001 is closed: workspace integer SLA defaults to 24, range 1..168 elapsed hours, frozen at workflow creation and returned as authoritative due-at.

Remaining decisions:
2. Future multiple queue topology is not admitted in V1.
3. No claim quota is defined; do not invent one.

## Acceptance authority

See:

`docs/quality/lead-ownership-distribution-acceptance.md`

## O1 approved Queue read policy

Approved clarification for assignment foundation (2026-09-29): `leads.read` remains ordinary Lead read; `leads.queue.read` is an additional authority for null-owned Leads. WORKSPACE and OWN can read unassigned Leads only when both capabilities are held. TEAM and CUSTOM fail closed. Without Queue read authority, list, search, counts, detail and effective access disclose no unassigned records. Queue read does not grant OWN callers mutation authority.

`assignmentState=ASSIGNED|UNASSIGNED` is filtered by the backend; omission adds no assignment filter. `UNASSIGNED` combined with `ownerId` is invalid (422). The nullable wire field remains required: `ownerId: null` is unassigned; omission is not an ownership state. Interactive creation binds the authenticated creator; delegated webhook creation stores null and retains integration/delegated audit provenance. Profile replacement preserves ownership and cannot assign or unassign.

O1 does not enable Claim, Assign, Handover or bulk assignment. `leads.claim` is reserved for O2 and is not Queue read authority. The system owner role gains the new capability through its existing exact-set upgrade path; custom role capabilities are never automatically extended. The frontend sales-manager template includes Queue read; sales representatives require an explicit grant.

## O2 local Claim admission — 2026-09-30

O2 implements only `claimLeadFromQueue`, POST `/workflows/lead-queue/{leadId}/claim`, with a closed empty JSON body. Normal read, Queue read and explicit `leads.claim` are required. OWN and WORKSPACE can atomically claim null-owned Leads for the authenticated active workspace member. TEAM and CUSTOM fail closed. The narrow Claim authority does not enable ordinary OWN Queue mutations. Lifecycle, qualification, Tasks and Activities are unchanged. Assign, bulk Assign and Handover remain unavailable; the full V1 decision remains TARGET.

If-Match and Idempotency-Key are required. Exact replay has no duplicate effects; a fresh assigned intent returns 409 LEAD_QUEUE_CLAIM_CONFLICT. The single workspace-qualified Lead uses an update lock before the idempotency lookup. Local real-host SQL and JSDOM evidence is recorded in sibling backend `backend-work/review/lead-queue-claim.md`; this is not independent CI or connected browser acceptance.

## Canonical Handover current verification — 2026-10-02

Corrective baselines: frontend `2059240736907dcad1e382666a0646de24e504b7`, backend `4db48b235b499b3c51bc9f7ba11e5845281263ee`. The public operation is `POST /workflows/lead-handover/{leadId}` with only `nextOwnerId` and trimmed `reason`. Human admission requires `leads.assign`, `tasks.assign` and `tasks.create`, with effective Lead/Task scope and write authority before effects. The obsolete human capability and optional Task policy are removed; service recovery authority remains.

Real HTTP/SQL verification passes 222 O4 checks, 223 cumulative HTTP checks and nine races. It proves initial OWN A→B success, current-resource replay without post-transfer ownership checks, historical completed intent replay, READ_ONLY owner replay, Tasks-commit crash/restart, revoked-human-grant service recovery, frozen SLA and cancellation fences. Tasks verification passes 48 checks plus eight SQL checks; Workspace passes 43; AccessControl passes 567/567; Assign passes 34 checks with no Task/Activity changes. All five affected DbContexts have no pending model changes.

Frontend generated contract and focused Handover gate pass, including actual scoped demo repository replay and Tasks-owned snapshot admission. Full suites retain baseline failures reproduced on the exact corrective frontend baseline. See the acceptance tracker for commands and limits. No connected browser E2E, governed freeze attestation, commit or push is claimed. Bulk Assign remains unavailable.
