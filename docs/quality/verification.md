# Verification Contract

## Command authority

`package.json` is the public command-name authority. `scripts/quality/quality-pipeline.json` is the executable quality-gate authority.

Documentation must not claim a public command exists unless it is present in `package.json`, and focused examples must reference a stable gate or group declared by the quality manifest.

## Pipeline groups

The full deterministic pipeline is defined once in `scripts/quality/quality-pipeline.json` and documented in [Quality Pipeline](./quality-pipeline.md).

```bash
npm run quality:list
npm run verify
```

Focused group commands are `npm run typecheck`, `npm run quality:group -- --group architecture`, `npm run quality:group -- --group unit`, `npm run quality:group -- --group contract`, `npm run quality:group -- --group integration`, `npm run quality:group -- --group route-smoke`, `npm run e2e:critical`, `npm run build` and the environment-gated `acceptance` group. The default `verify` command includes production build and excludes external acceptance; CI invokes acceptance explicitly when protected bindings exist.

`quality.quality-pipeline` ensures every deterministic gate is assigned once or explicitly excluded, and prevents the former long shell-chain orchestration from returning.

## Primary gates

### TypeScript

```bash
npm run lint
npm run quality:gate -- --gate quality.strict-core
npm run quality:gate -- --gate quality.strict-type-regions
npm run quality:gate -- --gate quality.type-safety-budget
```

`npm run lint` compiles the complete TypeScript project with global `strict: true` and `useUnknownInCatchVariables: true`.

`quality.strict-core` applies `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` to shared application, domain, HTTP, money and Order-to-Cash boundaries. `quality.strict-type-regions` requires those protected regions to remain free of explicit `any`, `as any`, non-null assertions and TypeScript suppression comments. The repository-wide type-safety budget is a downward-only ratchet for remaining compatibility debt.

### Repository naming and documentation

```bash
npm run quality:gate -- --gate quality.repository-naming
```

Protects responsibility-based file names and source terminology, keeps root Markdown limited to the current product documents and `AGENTS.md` repository guidance, verifies documented npm commands against `package.json`, and validates script targets. Legitimate business phrases such as `Phase 1 Contract signed` remain allowed because the gate does not ban the generic word `Phase`.

### Frontend contract baseline

```bash
npm run quality:gate -- --gate quality.contract-baseline
```

Protects the non-zero release identity, package/lock agreement, document verification identity, five accepted backend-foundation ADRs, the complete compatibility ledger, and the Receivables-aging versus accounting-DSO documentation boundary.

### Architecture

```bash
npm run quality:gate -- --gate quality.architecture
```

Protects dependency direction, module boundaries, workflow/public API rules, browser-global restrictions and current business ownership invariants.

### Repository cleanup contract

`npm run quality:gate -- --gate quality.repository-cleanup` protects paths removed after consumer review, rejects stale references to those paths, requires zero unreviewed `dead-candidate` files, and requires every retained compatibility file to have a runtime, test, or tooling consumer. The permanent removal manifest is `scripts/repository-cleanup/removed-paths.json`.

### Global data ownership

```bash
npm run quality:gate -- --gate quality.global-data-boundaries
```

Protects the removal of the shared data barrel and global mock directory, requires Workspace Config defaults and module demo seeds to stay with their owners, rejects direct presentation imports from `dev-memory`, and prevents runtime code from importing test/dev-only data.


### Global type ownership

```bash
npm run quality:gate -- --gate quality.global-type-boundaries
```

Protects removal of the root business type barrel, rejects `@/types` imports, requires explicit module/platform type owners and prevents Workspace Config from declaring a parallel Customer aggregate.


### Presentation responsibility

```bash
npm run quality:gate -- --gate quality.presentation-responsibility
```

Protects thin page/form entrypoints, typed controller/view companions, render-free controller hooks, persistence-free views and Customer detail section delegation. Source-level UI contracts read the complete presentation composition instead of assuming route orchestration, interaction logic and workspace markup remain in one file.

## Repository inventory

```bash
npm run repo:inventory
npm run repo:check
```

The generator records modules, routes, capabilities, workspace flags, workflows, public boundaries, persistence ownership, repository implementations, browser events, mock/default sources, compatibility and deprecated candidates, large files, circular dependencies, file classifications and critical-journey evidence. The checker fails when the committed JSON/Markdown inventory drifts or when a critical journey references missing source evidence or stable quality gate IDs.

### Authenticated application startup

```bash
npm run quality:gate -- --gate quality.authenticated-app-startup
```

Bundles and renders the authenticated Dashboard shell in a browser-like runtime. It verifies that hash routing is owned by `createHashRouter`/`RouterProvider`, that `useBlocker` receives DataRouterContext, and that a valid session cannot fall through to the top-level application error boundary during startup.

### Authentication experience

```bash
npm run quality:gate -- --gate quality.auth-ux-contracts
```

Protects the shared light authentication shell, minimal copy, Google and Microsoft entry points, focused verification-code input, implementation-neutral user messages, and removal of heavy or assurance-oriented presentation from sign-in, registration, recovery, invitation, workspace selection, and access-state screens.

### Enterprise security and resilience evidence

```bash
npm run quality:gate -- --gate quality.auth-session-contracts
npm run quality:gate -- --gate quality.workspace-isolation-contracts
npm run quality:gate -- --gate quality.enterprise-security-evidence
npm run quality:gate -- --gate quality.write-boundary-authorization
npm run quality:gate -- --gate quality.integration-resilience
npm run quality:gate -- --gate quality.lead-webhook-connector
```

Protects MFA and session policy, fail-closed production authentication, workspace membership and tenant boundaries, capability/data-scope checks at mutation owners, redacted denial evidence, canonical tamper-evident hashing, protected-key backup/restore planning, and connector retry/idempotency/rate-limit behavior. The Lead webhook gate proves a development-adapter end-to-end path; it does not claim a live third-party provider or production backend.

### Role-based navigation and product language

```bash
npm run quality:gate -- --gate quality.role-based-navigation
npm run quality:gate -- --gate quality.read-only-cross-domain
npm run quality:gate -- --gate quality.product-glossary
npm run quality:gate -- --gate quality.user-facing-identifiers
npm run quality:gate -- --gate quality.bilingual-ui
```

Protects role-focused navigation for Sales, Finance, Operations, Customer Success and administrators; keeps cross-domain status available in an explicit read-only mode; verifies action-route capability guards; enforces the canonical VI/EN glossary; and prevents raw member, owner, creator, updater or status identifiers from reaching normal user-facing surfaces. Menu focus is an experience policy and never grants capabilities.

### User-experience baseline and pilot fixture

```bash
```

Validates the 23-item research backlog matrix, route and guidance links, source ownership, acceptance evidence, documented test commands, and the temporary plan deletion contract.

```bash
npm run quality:gate -- --gate quality.pilot-journey-fixture
```

Validates the connected pilot customer journey, authenticated Sales ownership target, manual/import/webhook ingress cases, ten acceptance steps, cross-record references, and the pilot measurement catalog.

### Sales Quick Create and pipeline health

```bash
npm run quality:gate -- --gate quality.sales-quick-create-contracts
```

Validates lifecycle-aware Lead, Contact, and Deal requirements; progressive disclosure targets; next-step requirements; days-in-stage, last-activity, stale and overdue indicators; forecast-category derivation; forecast change history; and the presentation/command boundaries that keep these behaviors active.

### Customer relationship integrity and reconciliation

```bash
npm run quality:gate -- --gate quality.customer-relationship-integrity
```

Validates canonical Contact/Organization relationship existence, Customer alias agreement, workspace isolation, commercial source chains, Support/Task relationship ownership, and duplicate-candidate reporting without automatic merge.

```bash
npm run quality:gate -- --gate quality.customer360-reconciliation
```

Validates Customer 360 lineage across Lead, Deal, Quote, Order and downstream operations; reconciles Customer population and transaction segments with Reports; checks Support relationship requirements and reconciliation idempotency.

### Metric Catalog and drill-down

```bash
npm run quality:gate -- --gate quality.metric-catalog-contracts
```

Validates bilingual and versioned metric definitions, source modules, included states, period/snapshot semantics, permissions, source-record routes, Dashboard/Reports formula reuse, cohort lineage and the rule that no growth percentage is emitted when the previous-period denominator is zero.

```bash
npm run quality:gate -- --gate quality.metric-drilldown-runtime
```

Exercises the report-period selector, cohort labeling, independent-snapshot labeling, KPI drawer, formula/source metadata, source-record list and safe restoration of report context.

### Studio configuration boundary

```bash
npm run quality:gate -- --gate quality.studio-single-authority
npm run quality:gate -- --gate quality.studio-quick-setup
npm run quality:gate -- --gate quality.studio-module-propagation
npm run quality:gate -- --gate quality.studio-currency-exchange-rates
npm run quality:gate -- --gate quality.studio-api-contract
npm run quality:gate -- --gate quality.studio-v1-removal
```

Validates eleven canonical routes, optional metadata-only Quick Setup, module ownership and propagation, ISO currency/exchange-rate behavior, generated configuration contracts and permanent removal of Studio v1.

### Guidance contracts

```bash
npm run quality:gate -- --gate quality.guidance-contracts
```

Validates complete CRM/Studio/People route coverage, the universal “Xem lại hướng dẫn thao tác” action, bilingual content, stable `data-guidance-id` targets, screen richness, capability references, ownership metadata, workflow links and user-facing terminology.

```bash
npm run quality:gate -- --gate quality.guidance-runtime
```

Exercises all current CRM routes, 11 Studio routes and 3 People routes, keeps current-screen guidance available while filtering actions by capability, and verifies bilingual search, safe missing-target handling and workspace-scoped progress persistence in JSDOM.

### OpenAPI and generated client

```bash
npm run api:generate
npm run api:check
```

The check validates OpenAPI 3.1 shared conventions, release/version alignment, deterministic generated files, the generated manifest and Receivables adapter behavior. Generation is a write command and is not part of the deterministic verification pipeline; drift checking is.

### Application composition

```bash
npm run quality:gate -- --gate quality.application-composition
```

Protects the single application composition root, all registered module/workflow bindings, public-boundary independence from concrete runtime wiring, and demo/connected adapter injection for the connected-ready Payment and Invoice ports. Browser-environment tests initialize composition only after their storage and authenticated session are ready.

### Commercial authoritative queries

```bash
npm run quality:gate -- --gate quality.commercial-authoritative-queries
```

Protects cursor-complete and detail authoritative resources for Lead, Deal, Quote and Order; server DTO projection; workspace-scoped invalidation; and visible loading, refresh, stale and retry states on list/detail surfaces.

### Reference financial vertical slice

```bash
npm run quality:gate -- --gate quality.financial-vertical-slice
```

Protects the Payment, Invoice and Receivables reference slice: authoritative list/detail resources, loading/error/refresh/cancellation behavior, canonical mutations, explicit expected versions, idempotency evidence, conflict recovery, post-mutation refresh and the prohibition on financial browser-repository authority in presentation.

### Mutation command authority

```bash
npm run quality:gate -- --gate quality.mutation-command-authority
npm run quality:gate -- --gate quality.record-retention-policy
```

Protects backend-facing lifecycle command envelopes, idempotency and expected-version metadata, typed outcomes, demo/connected authority selection, transaction rollback evidence for multi-owner demo workflows, and the prohibition on presentation-owned state transitions, storage writes or direct transport mutations.

### HTTP and API foundation

```bash
npm run quality:gate -- --gate quality.http-api-foundation
```

Protects the shared HTTP client, fail-closed connected composition, access-token and workspace headers, request/correlation IDs, idempotency and expected-version headers, safe retry rules, timeout/cancellation behavior, decimal-string money serialization, typed API errors and the prohibition on direct module-level `fetch` calls.

### Route module loading

```bash
npm run quality:gate -- --gate quality.route-module-loads
```

Loads the current lazy route modules and verifies their expected exports.

### Form runtime and sizing

```bash
npm run quality:gate -- --gate quality.form-runtime-sizing
```

Protects modal widths, complexity sizing, form surface usage, Product Picker composition, source-prefill behavior and native form safety.


### Order-to-Cash operations

```bash
npm run quality:gate -- --gate quality.order-operations-frontend-contracts
```

Protects multi-line and partial invoicing, canonical Payment Record detail, development configuration boundaries, audited allocation reversal, Payment Request communication, receivable operations, statements, Return shortcuts, shared evidence and async mutation contracts.

### Shipping create dismissal

```bash
npm run quality:gate -- --gate quality.shipping-create-page-contracts
```

Protects one-shot deep-link intent consumption and all modal close paths.

### Sidebar access migration

```bash
npm run quality:gate -- --gate quality.sidebar-navigation-migration
```

Protects current CRM navigation and schema migration of persisted access snapshots without implicitly broadening custom roles.

### Workspace navigation and language

```bash
npm run quality:gate -- --gate quality.workspace-navigation-language
```

Protects workspace-scoped Work routes, real Task-backed Calendar routing and shell locale consistency.

### Organization B2B presentation

```bash
npm run quality:gate -- --gate quality.organization-b2b-ui
```

Protects Organization as B2B identity, Contact as person identity, representative linking and Organization commercial-tab buyer semantics.

### Forecast and AI governance

The removed setup presets, configuration sandbox, Workspace Health Check and Studio configuration search are no longer quality authorities. Forecast and AI checks remain independent of the Studio replacement.

```bash
npm run quality:gate -- --gate quality.forecast-analytics
```

Validates Commit, Best Case and Pipeline category totals, weighted value, owner breakdown, snapshot history and period-matched forecast accuracy.

```bash
npm run quality:gate -- --gate quality.order-to-cash-metrics
```

Validates the operational Order collection cycle, delivery success, COD reconciliation, return rate and refund-cycle calculations, and asserts that accounting DSO/receivables aging are not fabricated from Payment obligations.

```bash
npm run quality:gate -- --gate quality.ai-governance-contracts
```

Validates L0–L3 autonomy boundaries, kill switch behavior, capability checks, approval and evidence requirements, data-class restrictions, blocked fields and workspace-scoped action-log retention.

### Production build

```bash
npm run build
```

Must complete successfully before a candidate archive is promoted.

## Aggregate verification

```bash
npm run verify
```

The aggregate command is intended to run the repository's current core compile, repository-policy, architecture, business, navigation and route-load gates.

When an execution environment causes the aggregate process to stall, run the constituent commands separately and report the distinction honestly. Do not convert independent PASS results into a false claim that the aggregate command itself completed.

## Baseline invariants for cleanup work

A documentation or naming cleanup must not silently change:

- registered module set;
- canonical route contracts;
- lazy route-module loadability;
- capability catalog and effective access behavior;
- workspace module visibility semantics;
- storage keys and schema contracts;
- Lead qualification outcomes;
- Deal/Quote/Order lifecycle invariants;
- Shipping and Return state machines;
- Payment/Shipping evidence boundaries;
- form runtime behavior.

Any intentional change to one of these requires its own product/architecture scope and regression evidence.

## Known current limitations

The frontend currently has limits that are not hidden by documentation:

- no complete real-provider shipping integration is claimed;
- source-level idempotency, webhook authentication evidence, secret references and tenant checks do not replace durable backend enforcement;
- browser tamper-evident audit and workspace backup drills are not immutable server audit or encrypted database backup evidence;
- browser/in-memory-oriented repositories are not a production persistence layer;
- no full real-browser E2E pass is implied by source, AST, module-load and build checks alone;
- Lead public re-export topology may produce circular chunk warnings;
- the main production entry chunk is above Vite's default warning threshold.

These are separate concerns from documentation and repository naming cleanup.

## Candidate packaging

A release candidate should include:

- the product source package;
- a SHA-256 checksum;
- verification results;
- a clear list of known pre-existing warnings or failures.

Worklog documents and delivery-history artifacts do not belong inside the product source archive.

## Record ownership milestone

```bash
npm run quality:gate -- --gate quality.record-ownership-contracts
```

Kiểm tra owner mặc định theo phiên đăng nhập, quyền bàn giao, self-claim từ hàng đợi chưa phân công, scope Của tôi/Của đội/Được phép xem, audit và phản hồi mở bản ghi sau khi tạo.

## Studio configuration verification

The removed aggregate gateway, visual builders, simulations and old storage contracts are not verification authorities. The six focused Studio gates above protect the current ownership and behavior.

- The architecture gate also enforces module/workflow dependency direction and prevents presentation, application, or domain code from importing concrete infrastructure/runtime wiring.

- `npm run quality:gate -- --gate quality.error-handling` verifies stable error codes/categories, safe UI presentation, structured details, and prohibits message-based error control flow.
- `quality.backend-audit-viewer` protects the workspace-scoped backend audit contract, response redaction/validation, shared Deal/Quote/Order/Payment/Invoice/Return/Studio/People UX, and correlation/evidence/before-after rendering.


## Connected backend acceptance

```bash
npm run quality:gate -- --gate quality.connected-acceptance-harness
npm run quality:gate -- --gate quality.connected-backend-integration
```

These deterministic gates verify the test-only host boundary and the real HTTP connected client/composition path. External backend and browser evidence use the manifest `acceptance` group and return `BLOCKED` when required environment or dependencies are unavailable. A local fixture PASS is not SQL Server, database restart or deployed-backend evidence.
