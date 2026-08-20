# Quality test ownership

Executable assertions belong under `tests/quality/**`. Repository automation, command-line entrypoints, code generation, compatibility dispatch, and quality orchestration remain under `scripts/**`.

Canonical ownership areas:

- `architecture/`: dependency, ownership, repository, composition, and source-boundary contracts.
- `unit/`: focused domain, policy, mapper, and application behavior tests.
- `contracts/`: product, user-interface, workflow, and API surface contracts.
- `integration/`: cross-module, persistence, composition, and critical journey tests.
- `runtime/`: browser-like runtime tests that do not require a real browser process.
- `route-smoke/`: lazy route loading and navigation smoke tests.
- `security/`: secret, identity, authorization, and connected-graph security contracts.

Quality executable ownership is final: all former `scripts/check-*` implementations have canonical owners in these directories. Legacy wrapper paths, the migration dispatcher and the migration ledger were retired after command consumers moved to stable manifest gate IDs.
