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
| Handover | current -> target member | eligible OPEN Lead Tasks -> target; create takeover Task | backend-orchestrated cross-module workflow |
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

Preferred workflow:

```http
POST /workflows/lead-handover/{leadId}
Idempotency-Key: required
If-Match: required
```

Body contains:

```text
nextOwnerId
reason
```

and only the concurrency evidence adopted by the backend workflow contract.

If versioned Task targets are carried by the request, they are concurrency evidence only. The backend MUST validate authoritative Task eligibility from Task state + recordRef and MUST NOT trust the client to define business scope.

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

Handover is backend orchestrated.

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

1. `DECISION_REQUIRED-HO-SLA-001`: takeover Task due/SLA policy.
2. Future multiple queue topology is not admitted in V1.
3. No claim quota is defined; do not invent one.

## Acceptance authority

See:

`docs/quality/lead-ownership-distribution-acceptance.md`

## O1 approved Queue read policy

Approved clarification for assignment foundation (2026-09-29): `leads.read` remains ordinary Lead read; `leads.queue.read` is an additional authority for null-owned Leads. WORKSPACE and OWN can read unassigned Leads only when both capabilities are held. TEAM and CUSTOM fail closed. Without Queue read authority, list, search, counts, detail and effective access disclose no unassigned records. Queue read does not grant OWN callers mutation authority.

`assignmentState=ASSIGNED|UNASSIGNED` is filtered by the backend; omission adds no assignment filter. `UNASSIGNED` combined with `ownerId` is invalid (422). The nullable wire field remains required: `ownerId: null` is unassigned; omission is not an ownership state. Interactive creation binds the authenticated creator; delegated webhook creation stores null and retains integration/delegated audit provenance. Profile replacement preserves ownership and cannot assign or unassign.

O1 does not enable Claim, Assign, Handover or bulk assignment. `leads.claim` is reserved for O2 and is not Queue read authority. The system owner role gains the new capability through its existing exact-set upgrade path; custom role capabilities are never automatically extended. The frontend sales-manager template includes Queue read; sales representatives require an explicit grant.
