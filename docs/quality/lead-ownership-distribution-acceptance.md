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

## O2 local acceptance evidence — 2026-09-30

Reviewed O1 was frozen separately at frontend `40a758828574c7f28191816a85686c244ec5c34b` and backend `ca824392e000c0ec15b707579cc9f29d0f33569c`. O2 adds the server-authoritative Unassigned Lead List view and direct Claim action. Claim alone becomes connected available; Assign, bulk Assign and Handover remain unavailable. O1 historical phase statements above describe the frozen O1 revision.

Reproduce backend authority, idempotency and two-actor SQL race with `scripts/verify-lead-queue-claim.ps1 -DatabaseName UnicoreCRM_O2Claim_<isolated-suffix>`. Reproduce frontend command/controller/presentation coverage with `npm run quality:gate -- --gate quality.lead-queue-claim`. The latter uses HTTP fixtures and JSDOM, not connected E2E. See sibling backend `backend-work/review/lead-queue-claim.md` for final acceptance, actual race IDs, all commands and inherited baseline failures. No later phase is admitted.

## O3 single-owner assignment evidence — 2026-09-30

Starting backend `118e964c021c127749a4828d6caa502dfa6f6e0b` and frontend `d586604bf0d34d583c060bc1919473b5729db5f7`. Dedicated `POST /leads/{leadId}/assign` accepts only required `ownerId` and `reason`; connected `assignLeadOwner` becomes available. Claim remains available; Bulk Assign and Handover remain unavailable. O3 is not FROZEN and requires controller source review after delivery.

Assigned records require current read/capability/record authority; null-owned records additionally require Queue visibility. Assign does not inherit Claim's OWN-null mutation exception. Target membership, version, audit, idempotency and serialized races remain backend-authoritative. A fresh same-owner intent returns `409 LEAD_OWNER_ALREADY_ASSIGNED` with no side effects. Audit stores previous/new owner, reason, trusted actor/workspace and command metadata; Tasks and Activities are unchanged.

The shared dedicated dialog is available from a single List/Queue row and the Work Panel Owner section. It shows the current owner, assignable target choices, required reason and an informational warning from authoritative scoped OPEN Tasks. Network ambiguity preserves key/version; 412 requires authoritative refresh and a fresh explicit confirmation. Successful assignment removes only the assigned ID from selection and refreshes the Queue. Frozen Claim pagination and Saved View selection semantics are unchanged.

Reproduce with `npm run quality:gate -- --gate quality.lead-owner-assign` and the existing Claim/ownership/access/Work Panel/detail gates. The focused Assign gate uses real React/JSDOM and HTTP fixtures; it does not claim connected browser E2E. Backend reproduction and exact real SQL race results are in sibling backend `backend-work/review/lead-owner-assignment.md` and JSON.

Products effective-access assertion and the full-suite Lead export assertion reproduce on the exact starting frontend SHA; classification PRE_EXISTING. No unrelated baseline fixes are included. The overall V1 business/decision status remains TARGET because future bulk and Handover operations remain closed.

O3 source-review follow-up retains an ambiguous Assign intent across dialog closure and record-authority reload, gates confirmation until scoped Task observation finishes, and applies authoritative version observations after pending settles. Independent read-only review found no unresolved actionable finding after these corrections. This does not provide a governed freeze attestation.

Additional mandatory gate failures are baseline debt: AI route guidance contracts/runtime, Contact Detail presentation responsibility, pinned unrelated mutation inventory and architecture metadata. The backend-readiness document scan fails only with four pre-existing ignored test-result Markdown files; the same failure reproduces on the exact starting SHA with those artifacts copied to an isolated baseline. They are preserved. Full verify current 6/318 and baseline 6/317 stop at architecture; all 13 current violations exist among 35 baseline violations. None is introduced by O3.
