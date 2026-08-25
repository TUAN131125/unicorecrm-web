# UnicoreCRM Frontend — Claude Operating Memory

Repository engineering rules live in `AGENTS.md` (dependency direction, module
boundaries, presentation/mutation/type/API/backend contracts, quality pipeline).
Read it in addition to this file. This file holds the operating memory that
survives the completed M0-M12 roadmap.

@docs/ai/PROJECT_STATE.md
@docs/ai/ARCHITECTURE_INVARIANTS.md
@docs/ai/ROADMAP.md
@docs/ai/DEFERRED_FINDINGS.md

## Repository

Local path:
`D:\Project_All\UnicoreCRM\frontend\unicorecrm-web`

Main branch: `main`

## Working-tree rule

The working tree may intentionally contain verified uncommitted work from
previous roadmap phases. Never discard existing changes merely because the tree
is dirty.

Before any change:

1. verify repository root / branch / HEAD;
2. inspect `git status`;
3. preserve prior verified work;
4. read `docs/ai/PROJECT_STATE.md`.

Never run without explicit user permission:

```text
git reset
git clean
git restore
git stash
git checkout <other branch>
git commit
git push
```

## Source authority

Current repository source and canonical contracts outrank historical reports and
prior conversation summaries.

Never invent:

```text
OpenAPI operations
backend readiness
workflow ownership
mutation evidence
aggregate IDs
connected fallbacks
```

Distinguish and label evidence explicitly:

```text
STATIC_SOURCE_PROOF
TEST_EXECUTED
NOT_VERIFIED
```

Do not claim backend or browser E2E verification unless it actually executed.

## Roadmap rule

The roadmap was fixed at M0–M12 and is now COMPLETE. M12 finished with result
`M12_FINAL_BLOCKED`: the frontend is verified, two external blockers remain.

Never create `MxA`, `MxB`, `Mx-R`, `Mx-V`, `M13`, or any additional M number.

There is no current phase to fix inside. A new finding is recorded in
`docs/ai/DEFERRED_FINDINGS.md` with a final owner (BACKEND, PRODUCT,
DATA_MIGRATION or ARCHITECTURE_DECISION) and a release impact — not assigned to
a phase.

## Development workflow

```text
audit the exact defect class
→ state the invariant
→ add a failing regression gate when a current defect exists
→ minimal fix
→ negative control
→ repo-wide same-class re-audit
→ targeted tests
→ full validation once
→ diff review
→ report
```

Do not repeatedly run the full suite during implementation.

## Inventory

The M0–M12 inventory exception has been retired. M12 performed the final
consolidation, so `docs/quality/repository-inventory.json` is current and
`quality.repository-inventory` / `npm run repo:check` MUST pass.

Regenerate with `npm run repo:inventory` after changing the repository's file
inventory. Never hand-edit counts. No validation failure may be dismissed
without proof.
