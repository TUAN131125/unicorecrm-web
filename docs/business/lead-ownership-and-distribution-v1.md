# Lead Ownership & Distribution V1

Status: **TARGET**

Authority: **Canonical product/business semantics for Lead ownership and distribution V1**

Reviewed frontend baseline: `TUAN131125/unicorecrm-web@1c0f02510510bccb01078c0cb8d6410a274154f6`  
Frontend contract version at reviewed baseline: `0.24.0-contract.0`  
Reviewed backend baseline: `TUAN131125/unicorecrm-backend@161a580417f05471c6f5c7a3faf1c95114f212f1`

> This document defines intended product and business semantics. It does **not** prove that the current connected backend implements them. OpenAPI and backend route admission must be verified before a connected capability is enabled.

## 1. Purpose

This specification closes the Lead ownership and distribution gap for UniCoreCRM.

The V1 business flow is:

```text
External Lead Ingress
Website / Import / API / Webhook
            |
            v
       Create Lead
            |
            v
      ownerId = null
            |
            v
        SALES QUEUE
        /         \
       /           \
 Sale Claim     Manager Assign
      |              |
      +------+- ------+
             |
             v
          ASSIGNED
             |
       +-----+-----+
       |           |
     Assign     Handover
       |           |
 Lead only     Lead
               + OPEN Tasks
               + takeover Task
               + audit evidence
```

Interactive creation by a salesperson follows a different admission path:

```text
Authenticated Sale manually creates Lead
                |
                v
owner = authenticated creating member
                |
                v
             ASSIGNED
```

The specification deliberately separates:

- **assignment state** from Lead lifecycle state;
- **Claim** from **Assign**;
- **Assign** from **Handover**;
- a filtered **Sales Queue view** from any fake queue aggregate or fake queue owner;
- frontend presentation from backend authority.

## 2. Scope

V1 includes:

1. Lead may be `UNASSIGNED` or `ASSIGNED`.
2. Website / Import / API / Webhook ingress creates unassigned Leads.
3. Interactive CRM creation by a salesperson assigns the authenticated creator.
4. A workspace Sales Queue exposes unassigned Leads.
5. Authorized sales members may Claim an eligible unassigned Lead.
6. Authorized managers/users may Assign a Lead to an active assignable workspace member.
7. Handover transfers an already-owned Lead under an explicit open Task policy, creates exactly one takeover Task, and writes authoritative audit evidence.
8. Lead List/Kanban/Detail/Work Panel expose assignment state without redesigning the frozen Lead UI.
9. Bulk Assign is admitted in V1 after single-record semantics are stable.
10. Connected mode remains fail-closed when any authoritative backend operation is unavailable.

## 3. Explicit non-scope

V1 MUST NOT implement:

- Communication Window;
- Email/Zalo/SMS inbox or provider routing;
- round-robin assignment;
- weighted load balancing;
- territory routing;
- skill-based routing;
- AI assignment;
- multiple named queues;
- team-specific queues;
- SLA escalation automation;
- automatic reassignment;
- automatic owner selection from Lead source;
- claim quotas unless separately approved;
- Bulk Handover;
- frontend orchestration of cross-module Handover;
- fake owner values;
- browser-local connected-mode ownership authority.

## 4. Definitions

### 4.1 Owner

The **Owner** is the workspace member with primary responsibility for the Lead.

V1 target model:

```text
ownerId: MemberId | null
```

`null` means **unassigned**.

### 4.2 Assignment state

```text
UNASSIGNED  <=> ownerId == null
ASSIGNED    <=> ownerId references an active/assignable authoritative workspace member
```

Assignment state is not `leadWorkState`.

It MUST NOT be encoded inside lifecycle values such as `NEW`, `CONTACTING`, `VERIFYING`, or `CLOSED`.

### 4.3 Sales Queue

The Sales Queue is a **query/view over unassigned Leads**.

It is NOT:

- a workspace member;
- a synthetic principal;
- a Lead owner;
- a new aggregate;
- a lifecycle state.

Forbidden representations include:

```text
ownerId = "queue"
ownerId = "unassigned"
ownerId = "system"
ownerId = any fake workspace member
```

### 4.4 Claim

Claim is the atomic business operation by which the authenticated actor becomes owner of an eligible unassigned Lead.

### 4.5 Assign

Assign changes only the Lead owner.

Assign does not reassign existing Tasks.

### 4.6 Handover

Handover is a higher-impact workflow:

```text
Lead owner changes
+ explicit KEEP_CURRENT_ASSIGNEES or MOVE_LEAD_OPEN_TASKS_TO_NEW_OWNER policy
+ one takeover Task is created
+ reason and authoritative audit evidence are recorded
```

## 5. Canonical operation matrix

| Operation | Typical actor | Before | After | Existing OPEN Lead Tasks | Takeover Task | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| Claim | Sale | `ownerId = null` | `ownerId = actor` | unchanged | no | not required |
| Assign | Manager / authorized user | null or member A | member B | unchanged | no | required |
| Handover | Manager / authorized user | member A | member B | KEEP unchanged / MOVE eligible snapshot to B | yes | required (1..1000) |

### 5.1 Invariant OP-001

`Assign` MUST NOT be implemented as a partial Handover.

### 5.2 Invariant OP-002

`Handover` MUST NOT be implemented by the frontend as:

```text
assignLeadOwner()
+ loop over Tasks
+ createTask()
```

Handover is backend-orchestrated.

## 6. Lead creation ownership policy

### 6.1 Interactive CRM creation

When an authenticated salesperson creates a Lead through the normal CRM create flow:

```text
ownerId = authenticated member
```

The backend resolves this authority.

The frontend MUST NOT fabricate another owner.

A manager-specific "create and assign" experience may be added only when its backend authorization contract is explicit.

### 6.2 External/inbound creation

The following sources enter unassigned:

- Website;
- CSV Import;
- API integration;
- Webhook;
- other delegated/external Lead ingress.

Canonical result:

```text
ownerId = null
assignmentState = UNASSIGNED
```

The integration/delegated principal MUST NOT become Lead owner merely because it authenticated the ingress.

### 6.3 Current-source conflict

At the reviewed backend baseline:

- `LeadProfile.OwnerId` is required;
- `Lead.ScopeOwnerId` is non-null;
- delegated ingress currently binds ownership to the delegated subject;
- list queries filter through owner-based scope.

These are current implementation facts, not V1 target semantics. Patch O1 must reconcile them before Queue/Claim is enabled.

## 7. Sales Queue semantics

### 7.1 Query model

The Sales Queue SHOULD be expressed through the canonical Lead list query, not through a new Queue aggregate.

Recommended target filter:

```text
assignmentState=UNASSIGNED
```

Examples:

```text
GET /leads?assignmentState=UNASSIGNED
GET /leads?ownerId={memberId}
```

Do not overload `ownerId` with a sentinel string.

### 7.2 Queue fields

The queue/list should expose only already-authorized Lead facts, such as:

- Lead display name;
- source;
- creation time;
- priority;
- permitted contact summary;
- interested-product summary when available;
- next follow-up;
- waiting age derived from authoritative timestamps;
- current assignment state.

Field security continues to apply.

### 7.3 Queue visibility

Unassigned does NOT mean workspace-public.

Only users whose effective access allows queue read/claim may see unassigned Leads.

Target policy:

```text
Admin / Sales Manager
  -> may see authorized unassigned queue

Sales member with queue/claim permission
  -> may see claimable unassigned Leads

Member without queue permission
  -> must not discover queue records through list/search/detail
```

The backend remains the authority.

## 8. Claim

### 8.1 Business contract

Preconditions:

- Lead exists in the current workspace;
- Lead is not archived;
- `ownerId == null`;
- actor is an active eligible workspace member;
- actor has the required Claim/effective-record-access permission;
- resource version is current.

Commit:

```text
oldOwner = null
newOwner = authenticated actor
```

The request MUST NOT accept arbitrary `ownerId`.

### 8.2 Concurrency

Claim is race-sensitive.

Scenario:

```text
Lead X is UNASSIGNED

Sale A ---- claim X
Sale B ---- claim X
```

Exactly one may commit.

The loser receives a typed conflict such as:

```text
LEAD_QUEUE_CLAIM_CONFLICT
```

and the frontend reloads authoritative Lead state.

No last-write-wins owner overwrite is allowed.

### 8.3 Idempotency

Claim requires an idempotency key and optimistic concurrency evidence consistent with repository policy.

A replay of the same committed intent must not create duplicate audit effects.

### 8.4 Audit

Authoritative evidence should record:

```text
event/action = LEAD_CLAIMED
leadId
previousOwnerId = null
newOwnerId = actor
actorId
workspaceId
occurredAt
command/correlation evidence
```

Claim reason is not required in V1.

## 9. Assign

### 9.1 Business contract

Assign accepts:

```text
targetOwnerId
reason
```

and concurrency/idempotency metadata.

Preconditions include:

- Lead exists and is mutable;
- target member belongs to the trusted workspace;
- target member is active and assignable;
- actor has Assign permission/effective command access;
- target owner is not fabricated from request-side role labels;
- version is current.

### 9.2 Task behavior

Assign changes the Lead only.

It MUST NOT modify:

- OPEN Tasks;
- COMPLETED Tasks;
- CANCELLED Tasks;
- Activities.

If the Lead has open Tasks owned by someone else, UI should warn:

> Gán Lead không tự động chuyển các công việc đang mở. Dùng Bàn giao nếu muốn chuyển cả trách nhiệm công việc.

### 9.3 Audit

Evidence must include:

```text
LEAD_ASSIGNED
oldOwnerId
newOwnerId
actorId
reason
occurredAt
```

## 10. Handover

### 10.1 Business contract

The frozen O4 instruction supersedes the historical Handover contract in this document and the older canonical-design workflow. The canonical operation is `handoverLeadWithTasks`:

```http
POST /leads/{leadId}/handover
If-Match: required
Idempotency-Key: required
X-Request-Id: required
X-Correlation-Id: required (8..128 characters)
```

The closed body contains exactly `newOwnerId`, trimmed `reason` (1..1000 characters), and required `openTaskPolicy`. The policy is exactly `KEEP_CURRENT_ASSIGNEES` or `MOVE_LEAD_OPEN_TASKS_TO_NEW_OWNER`; omission has no default. No public Task IDs or Task versions are accepted.

A new admission requires an existing, nonarchived, already-owned Lead; a different active assignable target member in the trusted workspace; current Lead version; and no incompatible ownership/conversion reservation. An unassigned Lead uses Assign or Claim.

### 10.2 Eligible Task snapshot and policies

KEEP preserves every existing Task assignee. MOVE authoritatively discovers the complete eligible set inside the Tasks participant transaction:

```text
status == OPEN
AND archivedAt == null
AND recordRef.moduleKey == "leads"
AND recordRef.recordId == targetLeadId
```

The authoritative snapshot is resolved when the Tasks participant commits. Tasks created after that commit are outside this Handover. Browser-visible Tasks and preview counts never define the set. Tasks for other records, completed/cancelled Tasks, archived OPEN Tasks, Activities, and historical authorship remain unchanged.

### 10.3 Mandatory takeover Task and SLA

Both policies create exactly one OPEN takeover Task assigned to `newOwnerId`, priority NORMAL, linked to this Lead. `sourceRef.type = LEAD_HANDOVER`, `sourceRef.id` identifies the durable Handover, and `sourceRef.evidence` carries the full reason without truncation.

Workspace `handoverAcceptanceSlaHours` defaults to 24 and permits integer values 1..168 elapsed hours. Initial workflow creation freezes the resolved SLA, authoritative occurred-at and due-at. Configuration changes, retry and recovery cannot recalculate these values. Connected frontend uses the returned `handoverTaskDueAt`; only demo authority calculates it from demo workspace configuration.

### 10.4 Result

The existing mutation envelope contains authoritative result fields:

```text
lead (existing LeadDocument)
openTaskPolicy
reassignedTaskIds (empty for KEEP)
handoverTaskId
handoverTaskVersion (numeric backend long, integer >= 0)
handoverTaskDueAt (ISO date-time string)
resolvedHandoverAcceptanceSlaHours (integer 1..168)
```

A newly created native Task can have version 0. The client must accept it. The server owns Task discovery and the due date.

### 10.5 Durable orchestration and recovery

Reuse the established Atomic Workflow mechanism with participant-local transactions: reserve the Lead, commit Tasks, complete the exact Lead reservation, then return success. Do not loop public Task assignment handlers or create a distributed database transaction.

A crash after Tasks commit retains a recoverable anchor. Service-authorized recovery completes the Lead; committed Tasks are not compensated back and the takeover Task is not duplicated. Freeze the original actor/request context for audit. Only one active Handover may exist per Lead; completed historical anchors do not prevent a later B → C command.

### 10.6 Retry and frontend behavior

Preserve the original idempotency key, expected Lead version and complete payload across ambiguity, including dialog close/reopen and observation that the target already owns the Lead. Exact replay remains subject to current backend authorization. A definitive 412 preserves the draft, blocks resubmission and requires explicit refresh/reconciliation. A new intent uses the newest authoritative version. Changing the actual Lead ID clears the previous record's retry state.

Both policies preflight `leads.handover` and `tasks.create`; MOVE additionally preflights `tasks.assign`, regardless of loaded Task count. New admission requires writable `ownerId`; retained replay can use read-only projection. Default eligible administrator/manager templates may include Handover; custom roles receive no blanket grant.

Task preview is read-only and informational. Task loading does not block Handover. Unread conversations are omitted without Communications authority. Preserve the existing dialog and Work Panel.

## 11. Task and Activity invariants

Frozen semantics remain:

```text
Task = actionable work
Activity = immutable historical event
```

MOVE Handover reassigns its eligible OPEN Task snapshot only; KEEP preserves assignees.

It does not "complete" or mutate Activity history.

No Activity text parsing is permitted to infer Task state.

## 12. Access-control model

### 12.1 Separate Claim and Assign authority

Claim and Assign are distinct operations.

A normal salesperson may be allowed to Claim from Queue without being allowed to reassign another salesperson's Lead.

Recommended capability/policy separation:

```text
leads.claim     # target new capability or equivalent explicit command decision
leads.assign    # existing assignment authority
```

If the repository chooses not to add `leads.claim`, an equally explicit operation-level effective-access decision is required. Broad `leads.update` is insufficient.

### 12.2 Handover authority

Handover requires explicit authority over:

- `leads.handover` and effective Lead record access;
- `tasks.create` for both policies;
- `tasks.assign` and effective authority for every eligible Task for MOVE.

The frontend must not infer permission from role names.

### 12.3 Effective record access

Queue/detail/mutations remain fail-closed.

Missing/stale/malformed authority does not preserve a prior ALLOW.

## 13. Frontend behavior

### 13.1 Preserve frozen Lead UI

Do not redesign:

- Lead List overall visual language;
- Kanban visual language;
- Lead Header;
- Lead Tabs;
- Lead Work Panel structure;
- global theme/Tailwind.

This phase changes ownership semantics and targeted actions only.

### 13.2 Lead List / Queue

Add an operational view/filter for unassigned Leads using the existing list/filter system.

Preferred concepts:

```text
Tất cả
Của tôi
Chưa phân công
```

or an equivalent owner filter.

For a claimable unassigned Lead:

```text
Nhận Lead
```

should be directly available from an appropriate row/action surface.

### 13.3 Lead Detail / Work Panel

Owner section:

Assigned:

```text
Phụ trách
Nguyễn Văn A
```

Unassigned:

```text
Phụ trách
Chưa phân công
```

If actor can Claim:

```text
[ Nhận Lead ]
```

If actor can Assign:

```text
[ Gán người phụ trách ]
```

Handover is shown only when authoritative availability allows it.

### 13.4 Claim UI

Claim is a direct operational action.

Do not open a form requiring an owner selection.

On race conflict:

```text
Lead này vừa được một nhân viên khác nhận.
```

then refresh authoritative state.

### 13.5 Assign UI

Use a small transactional form/dialog containing:

```text
Người phụ trách mới
Lý do
```

If open Tasks exist, show the non-transfer warning.

### 13.6 Handover UI

Keep the already-approved transactional dialog surface.

Its UI must reflect backend availability and must not simulate Handover locally.

## 14. Bulk behavior

V1 target:

```text
Bulk Assign    = YES, after single Assign is authoritative
Bulk Handover  = NO
```

Bulk Assign must be backend-authoritative and version-aware.

Do not implement browser loops over single-record Assign.

## 15. Ingress source behavior

| Source | V1 owner result |
| --- | --- |
| Salesperson manual CRM create | authenticated creator |
| Website | unassigned |
| CSV Import | unassigned by default |
| API integration | unassigned |
| Webhook | unassigned |
| External delegated ingress | unassigned |

A future manager "create and assign" flow is allowed only after explicit contract approval.

## 16. Failure and recovery rules

Connected frontend must:

- await authoritative mutation responses;
- preserve input for recoverable Assign/Handover failures;
- refresh on version/claim conflict;
- never fall back to browser persistence;
- never keep a local owner change when backend commit failed;
- never infer success from HTTP timeout;
- use idempotent retry only under the adopted policy.

## 17. Source-authority order for implementation

Coding agents must use:

1. this business-semantics spec for V1 product meaning;
2. admitted backend routes and domain implementation for what is actually executable;
3. current OpenAPI for transport contracts that are genuinely admitted;
4. frozen Lead Foundation contracts;
5. frozen Lead Work Panel contracts;
6. existing frontend visual patterns;
7. incomplete legacy implementation details.

Important:

> A generated frontend method or a backend-readiness `READY` label is not proof that the reviewed backend host maps and implements the endpoint.

## 18. Reviewed repository gaps

At the reviewed baselines, the following conflicts exist.

### 18.1 Frontend/backend readiness drift

Frontend-generated contracts and backend-readiness registries contain operations such as:

- `claimLeadFromQueue`;
- `assignLeadOwner`;
- `handoverLeadWithTasks`;
- several bulk Lead operations.

However, reviewed backend `LeadsEndpoints.cs` maps only:

- list;
- get;
- create;
- replace profile;
- advance work state;
- disqualify;
- reopen;
- archive;
- archive batch.

Therefore connected availability must remain fail-closed until backend route/application support is verified.

### 18.2 Owner nullability

Current backend domain requires owner and projects `ScopeOwnerId` as non-null.

V1 requires a real unassigned state.

This is a foundational backend change and must be completed before Queue Claim.

### 18.3 Delegated ingress

Current delegated ingress ownership binds to a delegated subject.

V1 external ingress policy requires unassigned ownership.

This policy change must be explicit and tested.

### 18.4 List query

Current list query accepts `ownerId` but cannot distinguish "no owner filter" from "unassigned only".

V1 requires an explicit assignment-state query contract.

## 19. Implementation patch sequence

Do not implement the whole phase in one uncontrolled patch.

### O1 — Assignment foundation

- nullable/unassigned Lead ownership;
- persistence and projection;
- access-control handling for unassigned records;
- interactive vs external creation policy;
- assignment-state list filter;
- no Claim/Assign/Handover UI enablement yet.

### O2 — Sales Queue + Claim

- queue read/filter;
- Claim command;
- race-safe Claim;
- audit;
- frontend Claim availability and conflict recovery.

### O3 — Assign

- single Lead Assign;
- target-member validation;
- required reason;
- no Task mutation;
- UI warning for existing open Tasks.

### O4 — Handover

- backend-owned workflow;
- eligible Task scope;
- Task reassign;
- takeover Task;
- atomicity/idempotency;
- audit;
- connected Handover dialog.

### O5 — Frontend consolidation

- Queue view;
- List/Kanban/Detail owner state;
- Work Panel owner actions;
- fail-closed availability;
- browser verification.

### O6 — Bulk Assign

- backend batch contract;
- atomic/version-aware semantics;
- list bulk UI.

### O7 — Connected E2E and hardening

- real backend acceptance;
- concurrency;
- workspace isolation;
- access-control;
- idempotency/replay;
- failure recovery.

Each patch stops after its acceptance gates pass.

## 20. Acceptance scenarios

### Q-01 External ingress creates unassigned Lead

```text
GIVEN a valid Website/API/Webhook/Import Lead
WHEN backend admits the Lead
THEN ownerId is null
AND the Lead is queryable through authorized Sales Queue
AND no delegated/integration principal is stored as owner
```

### Q-02 Manual Sale create remains owned

```text
GIVEN Sale A creates a Lead interactively
WHEN creation commits
THEN ownerId = Sale A
AND the Lead does not enter Unassigned Queue
```

### C-01 Claim

```text
GIVEN Lead X is UNASSIGNED
WHEN Sale A claims X
THEN ownerId = Sale A
AND authoritative audit contains LEAD_CLAIMED
```

### C-02 Claim race

```text
GIVEN Lead X is UNASSIGNED
WHEN Sale A and Sale B claim concurrently
THEN exactly one commits
AND the loser receives a typed claim conflict
AND the Lead has exactly one owner
```

### A-01 Assign does not transfer Tasks

```text
GIVEN Lead owner = Sale A
AND three OPEN Lead Tasks are assigned to Sale A
WHEN an authorized manager assigns Lead to Sale B
THEN Lead owner = Sale B
AND all three Tasks remain assigned to Sale A
AND assignment reason is audited
```

### H-01 Handover transfers only eligible Tasks

```text
GIVEN Lead owner = A
AND 2 OPEN Lead Tasks
AND 1 COMPLETED Lead Task
AND 1 CANCELLED Lead Task
AND 1 archived OPEN Lead Task
WHEN Lead is handed over to B with MOVE_LEAD_OPEN_TASKS_TO_NEW_OWNER
THEN Lead owner = B
AND the 2 OPEN Tasks are assigned to B
AND COMPLETED Task is unchanged
AND CANCELLED Task is unchanged
AND archived OPEN Task is unchanged
AND exactly one takeover Task is created for B
AND authoritative audit contains the reason
```

### H-02 Handover scope excludes unrelated Task

```text
GIVEN an OPEN Task shares the same relationship but recordRef points to another record
WHEN Lead is handed over
THEN that Task is unchanged
```

### H-03 No partial Handover

```text
GIVEN any participant cannot commit Handover safely
WHEN workflow fails
THEN frontend must not observe a successful Lead-only Handover
AND no silent partial terminal state is accepted
```

### AC-01 Unauthorized member cannot enumerate Queue

```text
GIVEN member lacks Queue/Claim read authority
WHEN requesting unassigned Leads
THEN backend does not disclose those records
```

### WS-01 Workspace isolation

```text
GIVEN Lead belongs to Workspace A
WHEN actor from Workspace B tries to read/claim/assign/handover it
THEN operation is denied without cross-workspace disclosure
```

## 21. Forbidden implementations

The following fail the V1 contract:

- fake `unassigned` member;
- queue stored as owner;
- frontend-only Claim;
- frontend-only Assign in connected mode;
- Handover coordinated by browser loops;
- reassigning Activity;
- transferring completed/cancelled Tasks;
- task matching by description;
- Claim accepting arbitrary owner ID;
- using role label such as "Manager" as authorization evidence;
- last-write-wins Claim;
- enabling generated-client methods merely because they exist;
- weakening Foundation/Work Panel tests to pass this phase.

## 22. Decisions already closed

### DEC-OWN-001

Website / Import / API / Webhook Leads enter **Unassigned / Sales Queue**.

### DEC-OWN-002

Interactive CRM Lead creation by a salesperson remains owned by the authenticated creator.

### DEC-OWN-003

Sales Queue is not a fake owner.

### DEC-OWN-004

Claim makes the authenticated claimant the owner.

### DEC-OWN-005

Assign changes Lead owner only.

### DEC-OWN-006

Handover transfers an owned Lead, applies explicit KEEP/MOVE Task policy, creates exactly one NORMAL takeover Task with frozen workspace SLA, and records audit reason.

### DEC-OWN-007

Completed and Cancelled Tasks are not changed by Handover.

### DEC-OWN-008

Bulk Assign is in V1 after single Assign; Bulk Handover is out of scope.

### DEC-OWN-009

Communications and automated routing are deferred.

## 23. Decisions still requiring explicit approval

### HO-SLA-001 — closed by frozen O4 authority

Workspace `handoverAcceptanceSlaHours`: integer, default 24, minimum 1, maximum 168, elapsed hours. Backfill missing legacy JSON with 24 through the Workspace configuration authority. Freeze resolved SLA, occurred-at and takeover due-at at workflow creation; replay/recovery reuse the same values. Connected UI never calculates the due date.

### DECISION_REQUIRED-CLAIM-LIMIT-001 — claim quota

No claim quota has been approved.

V1 implementation should not invent a quota. If capacity limits are required, define a separate routing/workload policy.

### DECISION_REQUIRED-QUEUE-TOPOLOGY-001 — future multiple queues

V1 specifies the unassigned workspace Sales Queue view only.

Do not add team/territory queues without a separate decision.

## 24. Cross-phase note: Customer qualification

Customer qualification is not implemented by this phase.

Previously agreed direction to preserve for the later qualification phase:

- Customer may be a direct terminal qualification outcome when the Lead is resolved directly into an authoritative Customer without requiring a Deal.
- Later Customer conversion after a prior NURTURE or OPPORTUNITY must preserve the original qualification outcome and attach the authoritative Customer reference.
- B2B relationship resolution must support Organization-only or Organization + representative Contact.
- Direct Sale remains distinct from Customer.

No Ownership patch may reinterpret these semantics.

## 25. Definition of done for the phase

The full Ownership & Distribution V1 phase is done only when:

```text
unassigned Lead ownership is authoritative
+ external ingress enters Queue
+ manual Sale create remains owned
+ Queue access is secure
+ Claim is race-safe
+ Assign is authoritative and Task-neutral
+ Handover is backend-orchestrated
+ eligible Tasks transfer correctly
+ takeover Task is authoritative
+ audit evidence exists
+ frontend is fail-closed
+ Bulk Assign is authoritative
+ connected-backend E2E passes
```

A frontend screenshot or generated API method alone is not completion evidence.

## O1 approved Queue read policy

Approved clarification for assignment foundation (2026-09-29): `leads.read` remains ordinary Lead read; `leads.queue.read` is an additional authority for null-owned Leads. WORKSPACE and OWN can read unassigned Leads only when both capabilities are held. TEAM and CUSTOM fail closed. Without Queue read authority, list, search, counts, detail and effective access disclose no unassigned records. Queue read does not grant OWN callers mutation authority.

`assignmentState=ASSIGNED|UNASSIGNED` is filtered by the backend; omission adds no assignment filter. `UNASSIGNED` combined with `ownerId` is invalid (422). The nullable wire field remains required: `ownerId: null` is unassigned; omission is not an ownership state. Interactive creation binds the authenticated creator; delegated webhook creation stores null and retains integration/delegated audit provenance. Profile replacement preserves ownership and cannot assign or unassign.

O1 does not enable Claim, Assign, Handover or bulk assignment. `leads.claim` is reserved for O2 and is not Queue read authority. The system owner role gains the new capability through its existing exact-set upgrade path; custom role capabilities are never automatically extended. The frontend sales-manager template includes Queue read; sales representatives require an explicit grant.
