# Quality Pipeline

## Purpose

The deterministic quality pipeline has one executable gate authority:

```text
scripts/quality/quality-pipeline.json
```

Schema version 2 stores the complete gate definition. Every gate declares a stable ID, historical command identifier, owner, group, canonical entrypoint, executable steps, timeout, requirements, stable shard key and open-handle policy.

`package.json` is only the public CLI surface. It does not register individual gates, and the runner never reads package scripts to discover or execute them.

## Public command surface

The supported package commands are intentionally small:

| Area | Commands |
|---|---|
| Development | `npm run dev`, `npm run build`, `npm run preview`, `npm run clean` |
| Quality | `npm run lint`, `npm run typecheck`, `npm run test`, `npm run verify`, `npm run verify:no-build` |
| Focused quality | `npm run quality:list`, `npm run quality:gate -- --gate <id>`, `npm run quality:group -- --group <id>` |
| Security | `npm run security:scan` |
| OpenAPI | `npm run api:generate`, `npm run api:check` |
| Repository inventory | `npm run repo:inventory`, `npm run repo:check` |
| Browser acceptance | `npm run e2e`, `npm run e2e:connected`, `npm run e2e:install`, `npm run e2e:critical` |
| Release evidence | `npm run release:prepare`, `npm run release:check` |

Individual package aliases such as `test:quotes` or `check:architecture` are retired. Stable manifest IDs are the focused-execution contract.

## Groups

| Group | Command | Responsibility |
|---|---|---|
| Lint | `npm run lint` | Global strict TypeScript compilation and syntax validation |
| Typecheck | `npm run typecheck` | Strict-core compiler, protected regions and type-safety ratchets |
| Architecture | `npm run quality:group -- --group architecture` | Dependencies, OpenAPI drift, composition, persistence, retention, errors and repository structure |
| Unit | `npm run quality:group -- --group unit` | Focused domain, policy, mapper and application behavior |
| Contract | `npm run quality:group -- --group contract` | Product, UI, API, workflow and source contracts |
| Integration | `npm run quality:group -- --group integration` | Cross-module, browser-like runtime and persistence integration |
| Route smoke | `npm run quality:group -- --group route-smoke` | Lazy routes, navigation, query stability and shell resilience |
| Critical E2E | `npm run e2e:critical` | Deterministic authenticated startup and critical-journey acceptance |
| Build | `npm run build` | Production Vite build and bundle budget |
| Acceptance | `npm run quality:group -- --group acceptance` | Environment-gated real backend and connected browser evidence |

`npm run test` executes the unit, contract, integration and route-smoke groups. `npm run verify` executes deterministic groups through production build and excludes external acceptance. `npm run verify:no-build` excludes both build and external acceptance. Run the `acceptance` group explicitly after a successful build when protected backend bindings are available.

List groups and stable gate IDs:

```bash
npm run quality:list
```

Run one gate:

```bash
npm run quality:gate -- --gate quality.secret-policy
```

Run one or several groups:

```bash
npm run quality:group -- --group architecture
npm run quality:group -- --groups unit,contract
```

Both focused commands fail closed when the required gate or group selector is missing.

## Runner behavior

The runner:

- validates manifest schema and ownership before execution;
- resolves repository paths from `import.meta.url`, not the caller working directory;
- runs direct manifest steps without package-script or shell-command discovery;
- applies a per-gate timeout;
- distinguishes `PASS`, `FAIL`, `TIMEOUT`, `OPEN_HANDLE`, `BLOCKED` and `NOT_RUN`;
- lets successful Node gates exit naturally;
- fails when an entry finishes but retains active resources after the configured grace period;
- stores native-dialog audit output outside the repository and removes it after the run;
- emits machine-readable JSON and JUnit reports when requested.

Example:

```bash
node scripts/quality/run-quality-pipeline.mjs \
  --group architecture \
  --report artifacts/quality/quality-report.json \
  --junit artifacts/quality/quality-report.junit.xml
```

Supported environment variables:

```text
QUALITY_REPORT_PATH
QUALITY_JUNIT_PATH
QUALITY_GATE_TIMEOUT_MS
QUALITY_SHARD
QUALITY_MANIFEST_PATH
```

Generated reports are execution artifacts and must not be included in a source archive.

## Stable sharding

```bash
npm run quality:group -- --group contract --shard 1/2
npm run quality:group -- --group contract --shard 2/2
```

The runner hashes `gate.shardKey`, currently the stable gate ID. Adding or reordering unrelated gates does not change existing assignments for a fixed shard count.

## Shared harness

Canonical helpers live under `scripts/quality/core/`:

- `repo-context.mjs` — repository root and repository-relative paths;
- `filesystem.mjs` / `filesystem.cjs` — deterministic walking and IO;
- `source-reader.mjs` — source collection and reading;
- `path-normalization.mjs` — portable path normalization;
- `stable-hash.mjs` — stable shard assignment;
- `quality-manifest.mjs` — manifest loading, indexing and validation;
- `reporting.mjs` — JSON/JUnit result schemas.

Quality executables must not add another generic recursive filesystem walker or resolve the repository through `process.cwd()`.

## Explicit exclusions

The manifest records public commands intentionally outside deterministic source verification:

- `e2e` requires provisioned Playwright browsers and a test environment;
- `e2e:install` installs environment dependencies and is not an assertion;
- `api:generate` writes deterministic generated artifacts; drift is checked by `quality.api-contract`;
- `repo:inventory` writes generated inventory artifacts; drift is checked by `quality.repository-inventory`.

## Maintenance contract

When adding or removing a gate:

1. Add or update its stable manifest definition and assign exactly one group.
2. Do not add an individual package alias; use `quality:gate` or `quality:group`.
3. Reuse the canonical repository/filesystem/source helpers.
4. Declare requirements, timeout, owner and shard key.
5. Run `npm run quality:gate -- --gate quality.quality-pipeline`.
6. Run `npm run repo:inventory` and `npm run repo:check`.
7. Run the focused group and then `npm run verify` when dependencies are available.

Do not restore a long package-script registry, path compatibility wrappers, positional sharding, a second executable gate authority or a forced successful process exit. See `docs/quality/ci-and-release.md` for CI and source-release evidence.


### Connected backend acceptance

```bash
npm run quality:gate -- --gate quality.connected-acceptance-harness
npm run quality:gate -- --gate quality.connected-backend-integration
npm run quality:group -- --group acceptance
```

The local integration gate runs a test-only Node HTTP host and verifies the actual connected HTTP/composition code. The `acceptance` group is environment-gated: missing real-backend URLs, runtime tokens, workspace fixtures, Vite or Playwright are reported as `BLOCKED`, never as inferred PASS. See `docs/quality/connected-backend-acceptance.md`.
