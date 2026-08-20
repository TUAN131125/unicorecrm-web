# CI and Source Release Contract

## Authority

The repository-owned GitHub Actions workflow is `.github/workflows/quality.yml`. It is intentionally ordered so high-confidence secret scanning runs before dependency installation, and release evidence is created only after source verification and production build.

The workflow uses a read-only repository token and the official GitHub actions for checkout, Node setup and artifact upload. Repository administrators must configure the workflow check as required in branch protection; source code cannot apply that repository setting by itself.

## Required order

1. Current-tree secret scan before install.
2. Lockfile and dependency installation policy.
3. Lint, typecheck and architecture gates.
4. OpenAPI validation, generated drift and breaking baseline.
5. Unit and contract gates.
6. Integration and route-smoke gates.
7. Deterministic critical journeys.
8. Production build and bundle budget.
9. Real backend and connected browser acceptance when protected environment secrets are configured.
10. Deterministic source archive, checksum, release manifest and CycloneDX SBOM.

External acceptance steps are skipped when their protected environment bindings are absent. They are never replaced by a mock PASS. The local connected HTTP integration remains part of the deterministic integration group and is evidence about frontend wiring, not production database deployment.

## Commands

```bash
npm run security:scan
npm run verify
npm run quality:group -- --group acceptance
npm run release:prepare
npm run release:check
```

`npm run verify` executes deterministic groups through production build and excludes environment-gated external acceptance. `npm run verify:no-build` excludes build and external acceptance. The acceptance group is invoked explicitly after a successful build when real backend bindings are available.

## Release evidence

`npm run release:prepare` writes only to the ignored `artifacts/release/` directory:

```text
unicorecrm-web.zip
unicorecrm-web.zip.sha256
unicorecrm-web.cdx.json
release-manifest.json
```

The ZIP writer is dependency-free and deterministic. It fixes entry timestamps, sorts paths, uses one root directory named `unicorecrm-web/`, excludes build/test/history artifacts and includes `.env.example` while excluding other environment files.

`npm run release:check` independently reads the ZIP central directory, inflates every entry, validates CRC and SHA-256 values, compares every archived byte to the verified source tree, checks the single-root and exclusion policies, verifies the checksum file and validates release-manifest/SBOM consistency.

The SBOM is generated from `package-lock.json` in CycloneDX 1.5 JSON format. It is release evidence outside the source ZIP, not source content.

## Legacy cleanup

The final authority no longer contains `scripts/check-*` wrappers, the gate migration manifest, the legacy dispatcher or the script-owned demo composition preloader. Quality assertions are owned by `tests/quality/**`; runtime test setup is owned by `tests/fixtures/**`; executable gate authority is owned only by `scripts/quality/quality-pipeline.json`.
