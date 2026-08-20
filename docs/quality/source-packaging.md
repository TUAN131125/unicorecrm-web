# Source Packaging Policy

This document defines the permanent packaging contract for the Unicore CRM source repository.

All humans, coding agents, automation, and assistants that create or deliver a source archive from this repository MUST follow this document.

## 1. Canonical source archive

The delivered source archive MUST always be named:

```text
unicorecrm-web.zip
```

The archive MUST contain exactly one top-level root directory:

```text
unicorecrm-web/
```

The archive name and internal root directory MUST NOT be changed to describe a task, release attempt, work stage, ticket, bug, or temporary state.

## 2. Forbidden delivery naming

Do not use delivery-process names in any delivered archive name, root directory, source path, report path, or packaging artifact.

Forbidden examples include, but are not limited to:

```text
phase
wave
PCR
batch
fix
hotfix
rootfix
candidate
final
latest
redesign
implementation-summary
refactor-progress
```

Task names, ticket names, bug names, dates, and temporary labels MUST NOT be appended to the source archive name.

Examples that are NOT allowed:

```text
unicorecrm-save-view-fix.zip
unicorecrm-hotfix.zip
unicorecrm-candidate.zip
unicorecrm-final.zip
unicorecrm-latest.zip
unicorecrm-phase-8.zip
```

The only allowed delivered source archive name is:

```text
unicorecrm-web.zip
```

## 3. Change history ownership

Change history MUST be managed with Git commits, branches, tags, and pull requests.

Do not encode history in file names or archive names.

Use:

```text
Git commit history
Git branches
Git tags
Pull requests
```

Do not use:

```text
before/
after/
old/
new/
final-2/
latest/
backup-fix/
```

inside the delivered source package.

## 4. Source package contents

The source archive MUST contain the verified project source tree only.

The archive MUST NOT contain:

```text
node_modules/
dist/
.git/
.env.local
.env.*.local
coverage/
artifacts/
temporary work directories
screenshots
recorded videos
build logs
test logs
verification logs
patch files
editor backup files
OS metadata
```

Common examples that MUST be excluded:

```text
Thumbs.db
.DS_Store
*.log
*.tmp
*.bak
*.orig
*.rej
```

## 5. Reports and worklogs

Do not add packaging reports, implementation reports, fix reports, progress notes, or temporary verification summaries to the source repository merely to document a task.

Do not create files such as:

```text
IMPLEMENTATION_REPORT.md
FIX_REPORT.md
FINAL_VERIFICATION.md
REFACTOR_PROGRESS.md
WORKLOG.md
```

unless such a document is a permanent current-state product or architecture document with an explicit repository owner.

If a user explicitly requests a report artifact, create it separately from the source archive. Do not place it inside `unicorecrm-web.zip`.

## 6. Pre-packaging verification

Before creating the source archive, the working tree MUST be reviewed.

Run:

```bash
git status --short
git diff --check
```

Only intentional source changes may remain.

Run the repository verification commands:

```bash
npm run security:scan
npm run api:check
npm run verify
npm run release:prepare
npm run release:check
```

If `npm run verify` cannot complete because of the execution environment, run its constituent commands individually and report the result honestly. Do not claim an aggregate PASS unless the aggregate command actually completed successfully.

Do not change tests, baselines, warnings, route contracts, capabilities, workspace flags, storage contracts, or business state machines merely to make packaging succeed.

## 7. Packaging input

The archive MUST be created from the exact verified working tree.

Do not package from:

```text
an older ZIP
a stale temporary copy
a different branch
an unverified export
a directory with generated build output mixed into source
```

The packaged source bytes must match the verified source bytes, except for intentionally excluded files and directories defined by this policy.

## 8. Required archive structure

The final archive MUST have this shape:

```text
unicorecrm-web.zip
└── unicorecrm-web/
    ├── src/
    ├── scripts/
    ├── docs/
    ├── package.json
    ├── package-lock.json
    ├── README.md
    ├── ARCHITECTURE.md
    └── ...other valid project source files
```

The archive MUST NOT have an extra nesting level such as:

```text
unicorecrm-web/
└── unicorecrm-web/
    └── src/
```

The archive MUST NOT contain multiple top-level roots.

## 9. Post-packaging verification

After creating the archive, verify all of the following:

1. Archive file name is exactly `unicorecrm-web.zip`.
2. The archive contains exactly one top-level root: `unicorecrm-web/`.
3. No forbidden delivery naming appears in archive paths.
4. No excluded directory or file is present.
5. The archive can be extracted successfully.
6. The extracted source tree matches the verified working tree, excluding only policy-approved exclusions.
7. The source archive does not contain temporary reports or logs.
8. The generated checksum, release manifest and CycloneDX SBOM are verified outside the source archive.

## 10. Delivery contract

When a task is complete, deliver exactly one source archive:

```text
unicorecrm-web.zip
```

Do not deliver multiple source variants such as:

```text
before.zip
after.zip
candidate.zip
final.zip
latest.zip
```

If additional evidence is requested, provide it separately from the source archive.

## 11. Rule priority

This packaging policy is a permanent repository rule.

When another instruction conflicts with this document, preserve the following invariants unless the repository owner explicitly changes this policy:

```text
archive name: unicorecrm-web.zip
root folder:   unicorecrm-web/
history:       Git, not filenames
source ZIP:    source only
reports:       separate and only when requested
```


The canonical implementation and CI ordering are documented in [CI and Source Release Contract](./ci-and-release.md).
