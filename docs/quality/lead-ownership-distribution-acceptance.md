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

- canonical Lead route, closed nextOwnerId/reason (1..1000) body and all four headers;
- owned, nonarchived Lead, different valid target and leads.assign record/field admission;
- the Tasks participant transfers the authoritative OPEN/nonarchived Lead Task snapshot;
- tasks.create, tasks.assign and complete eligible-set authority;
- exactly one NORMAL takeover Task, full reason evidence, numeric version >= 0, server-returned ISO due-at;
- workspace SLA default 24/range 1..168, frozen across replay, configuration change and recovery;
- crash after Tasks commit recovers Lead without Task compensation or duplicate takeover work;
- repeated later B → C admission, active-only uniqueness, stable idempotent replay;
- stable key/version/payload across ambiguity, target-owner observation and same-Lead close/reopen;
- actual record-ID changes clear retry state; new intent chooses newest observed version;
- 412 preserves the complete draft and requires explicit refresh;
- loaded Tasks do not define authoritative admission; no fabricated unread count;
- connected frontend never loops Task mutation commands.

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

## O4 frontend verification evidence — 2026-10-01

The permanent gate is `npm run quality:gate -- --gate quality.lead-handover`. It exercises the generated canonical request/result, numeric Task version 0, rejection of malformed responses, stable payload/key/version, route-change reset, monotonic new-intent version, same-Lead close/reopen, replay after observing target ownership, 412 draft preservation/explicit refresh, canonical UI and demo snapshot/SLA replay. It uses React/JSDOM and HTTP fixtures, not connected browser E2E.

The final review regressions cover the real Handover dialog switching A→B without remount (close and clear owner/reason), preserving the same-Lead ambiguous draft on close/reopen, and retaining authoritative version 15 after a later prop 12 and an earlier result/refresh 8. The original ambiguous payload/key/version remains unchanged. No remaining O4 source-review fix is identified.

All commands below run from `frontend/unicorecrm-web`. Local logs are ignored verification artifacts, not portable CI evidence.

| Command | Actual result | Log |
| --- | --- | --- |
| `npm run api:generate` | PASS, 23 generated artifacts | Native generated manifest and checksum |
| `npm run api:check` | PASS, 301 operations: 273 ready / 28 blocked | `.git/o4-final-api-check.log` |
| `npm run quality:gate -- --gate quality.lead-handover` | PASS 1/1; 86 equality/deep-equality assertions plus rejection/source assertions | `.git/o4-final-focused.log` |
| `npm run quality:gate -- --gate quality.strict-core` | PASS 1/1 | `.git/o4-final-quality.strict-core.log` |
| `npm run lint` | PASS 1/1 | `.git/o4-final-lint.log` |
| `npm run build` | PASS, entry 265.18 KiB; largest chunk 484.46 KiB / 500 KiB budget | `.git/o4-final-build.log` |
| `npm run verify` | FAIL: 6/319 passed, architecture gate failed, 312 subsequent gates not run | `o4-verification.log` |
| `npm run quality:group -- --groups unit,contract,integration,route-smoke` | FAIL: 33/153 passed, Lead data safety failed, 119 subsequent gates not run | `.git/o4-tests.log` |

The individual 22-gate review uses `npm run quality:gate -- --gate <gate-id>`; initial results are `.git/o4-focused-results.json` and `.git/o4-quality.<gate-name>.log`. Passing gates cover Handover, API boundary, owner Assign, Queue Claim, ownership/distribution contracts, Work Panel, detail work resources, form recovery, strict core/regions, API contracts/management, frontend/backend separation and workflow ownership. Pipeline count expectations were updated from 338 to 339 for the new permanent gate; inventory is regenerated and checked after the final patch. Their final logs replace the initial drift failures.

Failure classification is **PRE_EXISTING**, independently reproduced from exact frozen frontend `17bd129eb84989c2b14bb0b58efd7fb65d80e881` using an archived checkout and the existing dependency installation:

| Failed gate | Baseline evidence | Cause |
| --- | --- | --- |
| `quality.architecture` | `.git/o4-baseline-architecture.log` | All 13 current violations appear among 35 baseline violations; unrelated Contacts/workflow/AI boundaries and stale authority inventory text. Capability count changes 131→132 for O4. |
| `quality.lead-data-safety-contracts` | `.git/o4-baseline-data-safety.log` | Existing Lead export visibility assertion. |
| `quality.lead-detail-surfaces` | `.git/o4-baseline-quality.lead-detail-surfaces.log` | Existing `lead-name` field assertion. |
| `quality.crm-ui-interaction-contracts` | `.git/o4-baseline-quality.crm-ui-interaction-contracts.log` | Existing Lead filter popover source assertion. |
| `quality.backend-readiness` | `.git/o4-baseline-readiness-with-artifacts.log` | Four existing ignored `test-results/*/error-context.md` files lack document-status entries. Baseline without these artifacts passes; copying the existing artifacts reproduces the current failure. |
| `quality.presentation-responsibility` | `.git/o4-baseline-quality.presentation-responsibility.log` | Existing Contact Detail presentation state. |
| `quality.mutation-command-authority` | `.git/o4-baseline-quality.mutation-command-authority.log` | Existing pinned Contact/Customer mutation inventory mismatch. |
| `quality.guidance-contracts` | `.git/o4-baseline-quality.guidance-contracts.log` | Existing AI route classification/metadata and stale coverage counts. |

These unrelated assertions were not weakened or repaired. Connected browser E2E, remaining stopped-suite gates, backend SQL/recovery and migration acceptance were not executed by this frontend slice. No commit or push was made, and all writes remain inside the frontend repository.

### O4 real backend evidence — 2026-10-01

Backend remains at `1106272021ea0f733c1f610c177e85e907142cac`, frontend at `17bd129eb84989c2b14bb0b58efd7fb65d80e881`; the O4 patch is uncommitted and unpushed.

| Command (backend root) | Actual result |
| --- | --- |
| `dotnet build --no-restore -p:UseSharedCompilation=false` | PASS, 0 warnings / 0 errors |
| `dotnet run --project scripts/TasksHandoverVerifier/TasksHandoverVerifier.csproj -p:UseSharedCompilation=false -- --sql` | PASS, 33 focused + 8 real SQL checks |
| `dotnet run --project scripts/LeadHandoverWorkspaceVerifier/UnicoreCRM.LeadHandover.WorkspaceVerifier.csproj -p:UseSharedCompilation=false` | PASS, 31 checks |
| `./scripts/verify-lead-handover.ps1 -DatabaseName UnicoreCRM_O2Claim_O4_Final_20261001093412 -RuntimeReady` | PASS, 192 O4 checks / 212 cumulative HTTP checks / 9 real races; solution and RealVerifier builds 0 warnings / 0 errors |
| `./scripts/verify-access-control-record-access.ps1 -DatabaseName UnicoreCRM_O4_AccessFinal_20261001093803 -Port 5337 -KeepDatabase` | PASS, 567 / 0 failures |
| `./scripts/verify-lead-owner-assign.ps1 -DatabaseName UnicoreCRM_O2Claim_O3_O4Final_20261001094054` | PASS, 34 Assign checks / 185 cumulative HTTP checks; Tasks and Activities unchanged |
| `dotnet ef migrations has-pending-model-changes --project src/<owner-project> --startup-project src/<owner-project> --context <context> --no-build` | PASS for LeadsDbContext, WorkflowsDbContext, TasksDbContext, WorkspaceDbContext and AccessControlDbContext |
| `git diff --check` | PASS |

The real fault host commits Tasks, returns injected HTTP 500, then stops and restarts. A same-key human retry with revoked Task grants and denied service grant returns 503 while preserving the exact Lead reservation and Task hash. Service scan returns 0 without its grant and 1 after restoration despite revoked human authority. Exactly one takeover Task and the frozen 12-hour SLA/due instant survive restart and configuration changes. Completed human replay denies missing Task capability (403) and hidden Task scope (404), then returns stable 200 after authority restoration.

Permanent participant tests prove both commit-before-fence and fence-before-late-worker orderings. Lead reservation fences use the production participant through a controlled test-only host endpoint; cancellation prevents a later reservation without changing owner/version, while committed reservation reconciliation preserves proof. All outgoing human success paths enforce current Task proof access after durable completion. No Workflows access to foreign DbContexts is introduced.

Backend logs are ignored local artifacts under `scripts/LeadHandoverRealVerifier/run-final.log`, `run-access-final.log` and `run-assign-final.log`. Isolated databases are retained; all owned test hosts are stopped. Limits: bounded three race samples per pairing; SQL-accelerated lease/retry expiry; injected process failure/restart rather than physical power loss; migration Down guards inspected statically, not executed. Connected browser E2E and subsequent Ownership phases are not claimed.

### O4 final frontend security and baseline follow-up

Demo completed replay checks current leads.assign/tasks.assign/tasks.create capabilities and returns stored evidence without rediscovering Tasks or rechecking transferred ownership. Initial admission checks Lead scope and every eligible Task before writes.

Main reports `npm run typecheck` PASS 3/3, `quality.connected-business-operation-availability` PASS and the Task boundary gate PASS. Its final `npm run test` fails at the same inherited Lead export assertion: 33/153 passed, one failed, 119 subsequent gates not run, 256.9 seconds; log `.git/o4-main-npm-test.log`.

Main's `quality.effective-record-access` failure is independently reproduced on exact `17bd129eb84989c2b14bb0b58efd7fb65d80e881`: 0/1 passed, `src/modules/products/detail-route.tsx must use backend-effective access boundary`, assertion line 79. Command: `npm run quality:gate -- --gate quality.effective-record-access` from `.git/o4-baseline`; log `.git/o4-baseline-effective-record-access.log`. Classification: PRE_EXISTING. The archive was created with `git archive` of the frozen SHA and shares installed dependencies through a `node_modules` junction; no source repair or weakened assertion is included.

Final post-hardening frontend commands are `npm run quality:gate -- --gate quality.lead-handover`, `npm run typecheck`, `npm run lint` and `npm run build`; logs `.git/o4-final-focused.log`, `.git/o4-final-typecheck.log`, `.git/o4-final-lint.log` and `.git/o4-final-build.log`. Inventory is regenerated after the main backend evidence/document updates and checked via `npm run repo:inventory` and `npm run quality:gate -- --gate quality.repository-inventory`, recorded in `.git/o4-final-inventory.log`.

Main also ran `quality.record-ownership-contracts` and `quality.workspace-isolation-contracts`: both PASS 1/1, with logs `.git/o4-main-quality.record-ownership-contracts.log` and `.git/o4-main-quality.workspace-isolation-contracts.log`. Connected availability and Task boundary each PASS 1/1. These complement the existing Claim, Assign, ownership, API and frozen Work Panel checks.

Local implementation/verification verdict: **O4 PASS**. Mandatory contract, service recovery, participant fencing, authorization, SLA, frontend retry and build checks pass; remaining repository failures are proven baseline debt. This verdict does not admit Bulk Assign, connected browser E2E or the next phase. Overall V1 stays TARGET, and the patch remains uncommitted/unpushed for source review.


## Canonical Handover corrective verification — 2026-10-02

This evidence supersedes earlier route/policy/capability descriptions. Starting commits are backend `4db48b235b499b3c51bc9f7ba11e5845281263ee` and frontend `2059240736907dcad1e382666a0646de24e504b7`; both HEADs remain unchanged and the repair is uncommitted.

- `verify-lead-handover.ps1`: 222 O4 checks, 223 cumulative HTTP checks, nine real races; fresh database `UnicoreCRM_O2Claim_O4_Corrective_Final2_20261002001525`.
- Tasks participant verifier: 48 focused checks and eight real SQL checks. Workspace verifier: 43/43. AccessControl: 567/567. Native Assign regression: 34 checks, 185 cumulative HTTP checks, zero Task/Activity changes.
- Build: zero warnings/errors. All five affected EF models have no pending changes. New migrations remove obsolete human grants and Task-policy storage while preserving applied history. Contract migration refuses an active historical workflow instead of reinterpreting it.
- Permanent Handover gate proves canonical two-field transport, stable ambiguous intent, explicit 412 refresh, successful and identity-change draft clearing, actual scoped demo OWN success/replay, full Tasks-owned eligible-set admission, field-write denial and local `lead.assign-owner` capability mapping.
- General frontend lint, typecheck, API check, build and repository checks pass. Existing Claim, Assign, ownership, isolation, connected availability, Work Panel, API boundary/management and pipeline gates pass.

Both full frontend suites were also run on an isolated clean worktree of the exact starting commit. `npm run test` stops at the same export-visibility assertion after 33/153 passes; `npm run verify` stops at existing architecture violations after 6/319 passes. Independent failing gates reproduce baseline Products effective access, Contact Detail presentation responsibility, unrelated mutation inventory, AI guidance metadata and the stale Handover description assertion in Lead detail surfaces (line 187). These are PRE_EXISTING; their tests/source were not weakened or repaired.

Evidence limits: real race coverage is bounded; recovery lease expiry is accelerated using SQL; the crash seam injects failure after the real Tasks commit and restarts the host. Rollback guards are inspected statically, not exercised as a production rollback. React/JSDOM and HTTP fixtures do not establish connected browser E2E or a governed freeze attestation.
