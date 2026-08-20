# SR-2 — Quality test ownership migration

## Status

COMPLETE for the current quality pipeline.

## Result

- 182 pipeline gates remain registered; no gate was removed.
- 180 gates are canonically test-owned and 2 commands remain repository tooling (`lint` and strict-core typecheck).
- One non-pipeline supporting assertion (`check:module-self-barrels`) is also canonically test-owned.
- All 179 former `scripts/check-*` implementations now live under `tests/quality/**`.
- Their historical paths remain temporary compatibility wrappers with no assertions.
- The 205 package commands are unchanged in this phase.
- No file under `src/**` changed.

## Canonical targets

| Area | Executables |
|---|---:|
| Architecture | 40 |
| Unit | 29 |
| Contracts | 64 |
| Integration | 38 |
| Route smoke | 8 |
| **Total moved** | **179** |

Existing directly test-owned security and tooling contracts remain under `tests/quality/security/` and `tests/tooling/`.

## Compatibility policy

At the close of SR-2, legacy package and CI consumers could still invoke `scripts/check-*` during the transition. SR-4 retired the individual package aliases. The final cleanup then removed all path wrappers, the migration dispatcher and the migration ledger after consumer audit confirmed stable manifest-owned execution.

## Evidence boundaries

The migration proves physical ownership, stable gate IDs, thin-wrapper integrity, import resolution and syntax preservation. Full dependency-backed execution remains dependent on a successful `npm ci`; a failed or unavailable dependency installation must be reported as `BLOCKED` rather than treated as a gate result.

## Self-review

A migration dry run initially treated import-like text inside source assertions as executable module specifiers. That medium-severity issue was caught before packaging. All canonical files were rebuilt from the input candidate using TypeScript AST nodes for real imports/exports/dynamic imports only. Final evidence records 227 rewritten relative module specifiers, zero unresolved references and zero syntax diagnostics across 179 moved executables.

No Critical or High finding remains. Compatibility wrappers are intentional low-severity migration debt with explicit removal criteria.

## Known limitations

- `npm ci` did not complete in the available package environment, so the uninterrupted dependency-backed `npm run verify` is not claimed.
- Production Vite build and browser E2E are `NOT RUN` for the same reason.
- `test:action-button-taxonomy` has a confirmed pre-existing failure at the same source marker in both the input candidate and the migrated target.

## Exact diff versus input candidate

- Added: 181
- Modified: 190
- Deleted: 0
- Same-byte: 1,299
- Output files: 1,670

Self-review score: **92/100**, with zero Critical blockers.
