# Data Defaults and Demo Runtime Ownership

This document defines where configuration defaults, reference data, development seeds and test fixtures belong.

## Ownership rules

- Business defaults belong to the module or platform capability that interprets them.
- Development seeds belong under the owning module's `infrastructure/dev-memory/` directory.
- Test fixtures belong under test-only directories and must not be imported by product runtime code.
- Presentation code consumes public snapshots, commands or canonical directories. It does not import seed files directly.
- A shared root-level data barrel is not an approved dependency boundary.
- Global mock-data directories are not approved runtime owners.

## Current canonical owners

| Responsibility | Canonical owner |
|---|---|
| Workspace configuration presets and defaults | `src/platform/workspace-config/workspaceConfigDefaults.ts` |
| Lead development records | `src/modules/leads/infrastructure/dev-memory/leadDemoSeed.ts` |
| Product development catalog | `src/modules/products/infrastructure/dev-memory/productDemoSeed.ts` |
| Product catalog consumption | `src/modules/products/public/catalog.ts` and the Products public API |
| Workspace member labels and choices | `src/platform/member-directory/index.ts` |

The workspace configuration default is business configuration, not mock data. It is used by the workspace configuration runtime and route-policy verification.

Lead and Product demo records are temporary inputs for the current browser-backed development repositories. They are explicitly module-owned and are not exported through a global data surface. Connected HTTP composition will be responsible for excluding development adapters and seeds from deployed runtime wiring.

## Consumption rules

Approved examples:

```text
presentation -> module public catalog snapshot
presentation -> platform member directory
infrastructure runtime -> same-module dev-memory seed
workspace configuration repository -> platform-owned defaults
```

Rejected examples:

```text
presentation -> dev-memory seed
module -> global mock array
runtime -> test fixture
platform configuration -> unrelated business module seed
```

## Verification

```bash
npm run quality:gate -- --gate quality.global-data-boundaries
```

The gate verifies that:

- the retired root-level data barrel and global mock-data directory do not return;
- no source or tooling command imports the retired data alias;
- presentation code does not import `dev-memory` seeds;
- production source does not import `src/dev/` or `src/test/` data;
- Workspace Config, Lead and Product data sources remain at their canonical owner paths.

The repository inventory separately records all default, seed and fixture sources so ownership drift remains visible.
