# Lead Ownership & Distribution V1 — Acceptance Contract

Status: **TRACKER**

Business authority: `docs/business/lead-ownership-and-distribution-v1.md`  
Backend decision: `docs/backend-readiness/lead-ownership-distribution-decision.md`

## 1. Acceptance principle

A UI surface, generated client method, demo runtime, fixture, or backend-readiness label is not sufficient evidence.

A capability is accepted only when its relevant combination of:

```text
domain
persistence
authorization
admitted backend route
OpenAPI
frontend binding
connected runtime
tests
browser behavior
```

is verified.

## 2. Patch gates

### O1 — Assignment foundation

Required evidence:

- Lead supports authoritative unassigned state without fake owner.
- interactive CRM create still assigns authenticated creator;
- external/delegated ingress creates unassigned Lead;
- assignment state projects correctly;
- list query can request unassigned explicitly;
- queue access does not leak unassigned records to unauthorized members;
- workspace isolation passes.

Stop if owner nullability cannot be implemented without weakening record-scope security.

### O2 — Queue + Claim

Required evidence:

- queue filter/view returns authorized unassigned Leads;
- Claim target owner comes from authenticated principal;
- Claim refuses already-assigned Lead;
- concurrent Claim admits exactly one winner;
- typed conflict refreshes frontend;
- audit evidence created once;
- replay is idempotent.

### O3 — Assign

Required evidence:

- target workspace member validated;
- inactive/unassignable member rejected;
- reason required;
- Lead owner changes authoritatively;
- existing Tasks remain unchanged;
- frontend warns that Assign does not transfer Tasks;
- version conflict preserves dialog input.

### O4 — Handover

Required evidence:

- backend owns orchestration;
- eligible OPEN Task query uses authoritative `recordRef`;
- completed/cancelled/unrelated Tasks unchanged;
- Lead and eligible Tasks converge to new owner;
- exactly one takeover Task;
- reason audited;
- retry/replay creates no duplicate takeover Task;
- no silent partial terminal state;
- connected frontend never loops Task reassign commands.

### O5 — Frontend consolidation

Required evidence:

- Lead List exposes unassigned view/filter without redesign;
- Kanban does not fabricate owner;
- Work Panel shows Assigned/Unassigned correctly;
- Claim/Assign/Handover visibility is fail-closed;
- frozen Lead Foundation, Header, Tabs, Work Panel layout remain unchanged.

### O6 — Bulk Assign

Required evidence:

- authoritative backend batch;
- versioned set;
- one idempotency boundary;
- no browser loop over single Assign;
- partial outcome semantics are explicitly defined and tested.

### O7 — Connected E2E

Must run against the real backend build used for acceptance.

## 3. Mandatory scenarios

### CREATE-01 — Interactive create

GIVEN Sale A is authenticated and may create Leads  
WHEN Sale A creates a Lead through normal CRM create  
THEN Lead owner is Sale A  
AND Lead does not appear as unassigned.

### CREATE-02 — Website ingress

GIVEN valid Website Lead ingress  
WHEN backend creates the Lead  
THEN owner is null  
AND no delegated principal becomes owner.

### CREATE-03 — Import ingress

GIVEN valid authoritative CSV import  
WHEN imported Lead is created under V1 default policy  
THEN owner is null unless a later separately approved assignment policy explicitly overrides it.

### QUEUE-01 — Authorized queue read

GIVEN unassigned Leads exist  
AND actor may read/claim queue records  
WHEN actor selects `Chưa phân công`  
THEN only authorized unassigned Leads are returned.

### QUEUE-02 — Unauthorized queue enumeration

GIVEN actor lacks queue authority  
WHEN actor filters/searches/opens queue records  
THEN backend does not disclose unauthorized records.

### CLAIM-01 — Happy path

GIVEN Lead X owner is null  
WHEN Sale A claims X  
THEN owner becomes Sale A  
AND audit records `LEAD_CLAIMED`.

### CLAIM-02 — Race

GIVEN Lead X owner is null  
WHEN Sale A and Sale B claim concurrently  
THEN exactly one commits  
AND the loser receives typed conflict  
AND authoritative owner is singular.

### CLAIM-03 — No arbitrary target

GIVEN Sale A sends Claim  
WHEN request attempts to supply Sale B as owner  
THEN the contract rejects/ignores arbitrary target according to the adopted closed request shape  
AND authenticated Sale A is the only permissible Claim target.

### ASSIGN-01 — Queue to owner

GIVEN Lead X is unassigned  
WHEN authorized Manager assigns X to Sale B with reason  
THEN owner becomes B  
AND audit persists reason.

### ASSIGN-02 — Reassign Lead only

GIVEN Lead owner is A  
AND three OPEN Lead Tasks are assigned to A  
WHEN Manager Assigns Lead to B  
THEN Lead owner is B  
AND the three Tasks remain assigned to A.

### ASSIGN-03 — Invalid target

GIVEN target member is not assignable in the trusted workspace  
WHEN Assign executes  
THEN operation is rejected  
AND current owner remains unchanged.

### HANDOVER-01 — Eligible Task transfer

GIVEN Lead owner is A  
AND two OPEN Lead Tasks are linked by recordRef  
AND one COMPLETED and one CANCELLED Lead Task exist  
WHEN Handover to B commits  
THEN Lead owner is B  
AND the two OPEN Tasks are B  
AND completed/cancelled Tasks are unchanged  
AND exactly one takeover Task exists.

### HANDOVER-02 — Relationship-only Task excluded

GIVEN OPEN Task shares relationshipRef but its recordRef points elsewhere  
WHEN Lead Handover occurs  
THEN that Task is not reassigned.

### HANDOVER-03 — Idempotent replay

GIVEN Handover committed  
WHEN the same idempotency intent is replayed  
THEN no duplicate takeover Task is created  
AND authoritative result is returned consistently.

### HANDOVER-04 — Failure convergence

GIVEN a participant cannot safely commit  
WHEN Handover fails  
THEN frontend must not present success  
AND no unacknowledged partial terminal state is accepted.

### SECURITY-01 — Cross-workspace

All Queue/Claim/Assign/Handover operations deny cross-workspace records.

### SECURITY-02 — Permission split

A user may be allowed to Claim but not Assign another user's Lead.

### FOUNDATION-01 — No Task/Activity regression

Task/Activity frozen semantics remain unchanged.

### UI-01 — Frozen UI preservation

No broad Lead List/Kanban/Header/Tabs/Work Panel redesign.

## 4. Suggested permanent quality coverage

Preferred new/updated gates:

```text
quality.lead-ownership-distribution-contracts
quality.lead-queue-claim
quality.lead-assignment
quality.lead-handover
quality.lead-ownership-connected-e2e
```

Do not add overlapping gates when an existing canonical gate already owns the rule.

Existing gates expected to remain green include the Lead lifecycle/API boundary, Task/Activity API boundary, effective-record-access, record-ownership, workspace isolation, idempotency/concurrency, Work Panel, and Lead detail surface gates.

## 5. Required report classification

Every agent report must classify failures:

```text
PRE_EXISTING
INTRODUCED
RESOLVED
BLOCKED_BY_BACKEND
BLOCKED_BY_UNRESOLVED_DECISION
```

## 6. Stop conditions

Stop the affected patch instead of inventing semantics when:

- fake owner is required to proceed;
- effective-record-access cannot represent unassigned safely;
- current backend endpoint is missing;
- Handover requires frontend orchestration;
- Task scope cannot be queried authoritatively;
- a shared Foundation invariant must be weakened;
- claim race safety cannot be proven;
- target member validity is not backend-authoritative;
- takeover SLA decision becomes required and remains unresolved;
- passing tests would require weakening assertions.

## 7. Final phase verdict

Only:

```text
LEAD_OWNERSHIP_DISTRIBUTION_PASS
LEAD_OWNERSHIP_DISTRIBUTION_NEEDS_FIX
LEAD_OWNERSHIP_DISTRIBUTION_BLOCKED
```

## O1 local implementation evidence — 2026-09-29

Assignment foundation is implemented locally against frontend `0.24.0-contract.0`: nullable authoritative owner, creator-bound interactive admission, unassigned delegated webhook admission, server-side assignment filtering, and additive `leads.queue.read` scope enforcement. Claim, Assign, Handover and bulk assignment remain unavailable in connected mode. No O2 runtime was added.

Reproduce frontend coverage with `npm run quality:gate -- --gate quality.lead-ownership-distribution-contracts`, plus the existing Lead API, lifecycle, business rules, Work Panel, detail surfaces and form recovery gates. Real backend/SQL evidence is produced by `backend/scripts/verify-inbound-lead-webhook.ps1` using a dedicated disposable database; the script destroys only the explicitly supplied test database. The local report is `backend/backend-work/review/lead-ownership-assignment-foundation.md` in the sibling backend repository.

The expanded backend harness verifies explicit null transport, WORKSPACE/OWN allowed and denied Queue access, TEAM/CUSTOM denial, filters/counts/cursors, field security, tenant isolation, immutable profile ownership, assigned profile/lifecycle/archive regression and delegated audit/idempotency. Frontend tests cover nullable mapping, invalid owner rejection, forwarding without local Queue filtering, disabled future commands and the unassigned Edit/Work Panel surfaces.

Cleanup acceptance is `LEAD_OWNERSHIP_O1_PASS` (2026-09-30). The six disputed gates were run independently on exact starting SHA `1c0f02510510bccb01078c0cb8d6410a274154f6` and on cleaned O1: five failures have identical baseline causes; overflow is a pre-existing frozen Work Panel policy conflict. Unrelated source/test repairs were removed. All required focused O1 gates and general checks pass. Full `npm run test` stops at the same baseline Lead export assertion (baseline 33/149, O1 33/150 before failure). Backend build, real inbound webhook, AccessControl (567 PASS / 0 FAIL), model and migration checks pass. See sibling backend `backend-work/review/lead-ownership-assignment-foundation-cleanup.md` and its JSON for commands, per-file cleanup and baseline logs. This is local O1 acceptance, not a green full suite, independent attestation or connected browser acceptance. Claim/Assign/Handover remain unavailable. No commit/push or later phase was started.
