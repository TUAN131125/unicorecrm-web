# Script modernization baseline audit

## Input checkpoint

- Archive: `unicorecrm-web(21)(3).zip`
- SHA-256: `6c9ccea9c8bef36022eb1d2a1a062f0f80fc183569826ac1de340d68c71ad782`
- Root: exactly one `unicorecrm-web/` folder
- Package: `unicorecrm-web@0.8.0-frontend.0`
- Git history: unavailable in the source archive

This checkpoint records the input tree before source changes. It remains the rollback authority for the first modernization tasks.

## Measured inventory

| Area | Input value |
|---|---:|
| Repository files | 1,467 |
| Source files | 1,171 |
| Source lines | 149,212 |
| Script files | 192 |
| Script lines | 22,885 |
| `check-*` files | 179 |
| `check-*` files using assertions | 170 |
| Existing test files | 3 |
| Package commands | 201 |
| Commands loading demo composition | 133 |
| Quality gates | 180 |
| Quality groups | 9 |
| OpenAPI operations | 130 |

The file-by-file ownership assessment is stored in `script-classification.json`. It classifies all 192 input script files without moving them.

## Verification evidence

| Check | Status | Evidence |
|---|---|---|
| Archive checksum and root | PASS | SHA matched; one root folder |
| Quality pipeline listing | PASS | 180 gates in 9 groups |
| OpenAPI generated drift | PASS | Generator check returned the stored fingerprint |
| Repository inventory | PASS | Existing inventory matched the input tree |
| Quality contract execution | BLOCKED | The input command requires `tsx`, which is not installed |
| Dependency install | BLOCKED | Package gateway returned HTTP 503 |
| Full verification | NOT RUN | Dependencies are absent |
| Production build | NOT RUN | Dependencies are absent |
| Browser E2E | NOT RUN | Dependencies and browser binaries are absent |
| Git history secret scan | BLOCKED | `.git` is not present |

No dependency-backed PASS is inferred from source inspection. The complete command and gate matrix is in `verification-matrix.json`.

## Baseline findings

1. Most executable assertions are owned by `scripts/**` rather than `tests/**`.
2. The quality manifest lists gate names, while `package.json` remains the entrypoint authority.
3. The input includes repeated application-composition bootstrap commands.
4. Connected startup still requires the host to provide the complete application service bundle.
5. Current-tree high-confidence provider patterns were not found by the initial bounded scan, but there was no permanent scanner or CI authority.
6. Development identities were centralized in one adapter file but were not isolated behind a dedicated development owner and machine guard.

## Safety boundary

The baseline task does not change product behavior, UI, domain rules, application composition or package commands. Source changes start only after this checkpoint and must remain reversible to the input archive.
