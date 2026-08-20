# Unicore CRM Architecture Constitution

This document describes the current architecture of the repository. It is organized by responsibility and invariant, not by delivery history.

The source of truth is the code that owns each business concept, the public APIs exposed by modules, the workspace route trees and the automated architecture checks.

## 1. Top-level structure

```text
src/
  ai/             CRM-scoped AI reasoning and mock-engine support
  app/            application composition, providers, shell and route assembly
  components/     shared product patterns and application-level UI pending owner extraction
  features/       bounded cross-cutting frontend features such as authentication
  guidance/       contextual product guidance contracts and presentation
  i18n/           locale runtime and translation catalogs
  migrations/     migration preview/backfill helpers; never runtime owners
  modules/        vertical business owners
  platform/       business-agnostic technical, navigation and application-state contracts
  shared/         approved generic UI, domain contracts and utility primitives
  workflows/      explicit cross-module business operations
  workspaces/      product-space composition, read models and workspace UI
```

This repository is frontend-only. The production backend is a separate ASP.NET Core modular-monolith solution. The frontend owns the OpenAPI contract candidate and generated TypeScript clients but no executable backend implementation.

The active product spaces are exactly:

```text
CRM
Studio
People & Access
```

AI is a CRM floating utility, not a fourth product space.

## 2. Dependency direction

The intended dependency direction is:

```text
platform
  ↑
module domain
  ↑
module application
  ↑
module infrastructure
  ↑
module presentation

module public APIs
  ↑
workflows
  ↑
workspace read models and workspace presentation
  ↑
app composition and shell
```

Key rules:

- `src/platform/` does not import business modules, workflows, workspaces or app composition.
- Module domain code is pure TypeScript and may depend only on pure identity contracts from the platform.
- Module application code does not depend on React, presentation or infrastructure.
- Infrastructure does not depend on presentation.
- A module does not deep-import another module's internals.
- A module never imports upward from `src/app/`; neutral route and application-state contracts belong to `src/platform/`.
- Workflows and workspaces consume module public APIs rather than internal files.
- Migration code is isolated from runtime imports.
- Browser storage and DOM globals stay out of domain/application code and pure read models.

These rules are enforced by `tests/quality/architecture/check-architecture.mjs`.

## 3. Module contract

Each vertical module may contain:

```text
src/modules/<module>/
  domain/
  application/
  infrastructure/
  presentation/       optional only for non-visual owners
  public/
    index.ts           canonical cross-boundary barrel
  runtime/
  index.ts             exports only manifest + public barrel
  manifest.ts
```

Every registered module has explicit domain, application, infrastructure, public and runtime ownership. Presentation is optional only when the owner has no visual surface. Responsibility must remain explicit.

### Domain

Owns:

- business types and state machines;
- invariants;
- calculations and validation rules;
- framework-independent policies.

Must not own:

- React components;
- routing;
- browser storage;
- network/provider implementations;
- another module's aggregate.

### Application

Owns:

- commands and queries;
- ports/interfaces;
- orchestration within one module.

Application code may coordinate its own domain and ports but must not reach into UI or concrete infrastructure.

### Infrastructure

Owns:

- repositories;
- persisted/browser-oriented snapshots;
- provider adapters;
- seed/backfill runtime data;
- subscriptions.

Infrastructure implements module ports. It does not define business truth by accident.

### Data defaults and development seeds

Configuration defaults belong to the platform or business owner that interprets them. Development records belong to the owning module under `infrastructure/dev-memory/`; presentation consumes public snapshots or canonical directories rather than seed arrays. Test fixtures remain test-only. The repository does not use a shared root-level data barrel or a global mock-data owner.

The current browser-backed development runtime still initializes selected module repositories from owner-scoped demo seeds. Connected HTTP composition must replace those development adapters rather than exposing the seeds through production application contracts.

### Type ownership

Business types live with the module or platform capability that owns their meaning. The repository has no root-level business type barrel. Domain entities, workspace configuration contracts and presentation-only models remain distinct, and consumers import the explicit owner rather than `@/types`. DTO, form and view-model contracts must not silently become canonical domain entities.

### Type safety

The complete TypeScript project compiles with global strict mode and unknown catch variables. Shared backend-facing contracts under `src/shared/application`, `src/shared/domain`, `src/platform/api`, `src/platform/api`, `src/shared/money` and `src/shared/order-to-cash` additionally enforce exact optional-property semantics and unchecked indexed-access protection.

Protected strict regions contain no explicit `any`, `as any`, non-null assertions or TypeScript suppression comments. Remaining compatibility debt elsewhere is controlled by a downward-only repository budget. See `docs/architecture/type-safety-and-strictness.md` and run `npm run quality:gate -- --gate quality.strict-type-regions` after changing protected contracts.

### Presentation

Owns:

- pages, panels and dialogs;
- interaction state;
- route-level module UI.

Presentation calls commands, queries, workflows or public runtime facades. It must not create hidden business ownership in component state.

Business lifecycle changes cross a typed mutation-command boundary. Presentation awaits an authoritative `MutationOutcome`; it does not directly sequence multi-owner writes, manufacture audit/event success, or treat a local repository update as backend completion. Demo composition may execute local handlers behind the same authority port, while connected composition sends the command envelope to the backend with idempotency, expected-version, workspace and correlation context. See `docs/architecture/mutation-command-authority.md`.

Durable and referenced records use explicit archive, cancel, void, close or anonymize commands. Hard delete is restricted to backend-authorized transient drafts with no references or retained audit evidence. See `docs/architecture/record-retention-and-destructive-actions.md`.

Large route surfaces use a thin entrypoint, render-free controller hook and dedicated view/section composition. Entrypoints coordinate routing and not-found states; controllers coordinate application operations and interaction state; views render the workspace. See `docs/architecture/presentation-responsibility.md`.

### API contract and generated transport

`docs/api/openapi.json` is the canonical transport-contract candidate for operations it declares. Deterministic generation produces frontend clients under `src/platform/api/generated/`; generated files are never edited by hand.

Generated DTOs are transport contracts, not module domain entities. Frontend infrastructure adapters may consume generated clients and map them into module-owned application/domain contracts. Presentation, workflows and module application code must not import generated transport DTOs directly.

The production backend target is an ASP.NET Core modular monolith using Clean Architecture, CQRS/MediatR, FluentValidation and SQL Server. Those implementation details must never leak into frontend modules or generated transport DTOs. See `docs/architecture/dotnet-sqlserver-backend-target.md`.

Run `npm run api:generate` after an intentional OpenAPI change and `npm run api:check` before completion. The generated `docs/api/api-operation-catalog.json` provides one machine-readable mapping for operation ownership, generated method, adapter, DTO, authorization, idempotency and concurrency policy. Module boundary requirements are defined in `docs/architecture/module-api-boundary-template.md`.

### Public API

`src/modules/<module>/public/index.ts` is the canonical cross-boundary API. The module root `index.ts` exports only the manifest and that public barrel. Other modules, workflows and workspaces import the module root and must not deep-import implementation files. Route-only entry modules remain separate and are imported only by application route assembly.

## 4. Current business owners

The canonical module set is defined by `src/modules/*/manifest.ts`; runtime route wiring is explicit in `src/app/router/workspaces/`.

| Module | Owns | Must not own |
|---|---|---|
| `leads` | Lead work state, qualification outcome, lead activities and lead queue data | Contact/Organization identity, Deal lifecycle, Quote/Order state |
| `contacts` | Individual person identity and person relationship fields | B2B account identity, Customer lifecycle state |
| `customers` | Customer lifecycle, health, segmentation, care ownership and relationship-level commercial profile | Person/organization identity, downstream Deal/Quote/Order/Payment truth |
| `organizations` | B2B account identity, representatives and organization relationship state | Embedded person identity, Workspace identity |
| `deals` | Opportunity lifecycle, next action, WON/LOST evidence and recycle decision | Buyer identity, Quote/Order lifecycle |
| `quotes` | Quote versions, quote status, line snapshots and revisions | Deal lifecycle, Order lifecycle |
| `orders` | Order state, buyer reference, commercial line snapshots, recipient and delivery prerequisites | Payment truth, carrier execution state |
| `payments` | Payment Plans, schedule lines, Payment Intents, payment transactions, allocations, customer credit, refund success and reconciliation state | Order lifecycle, Invoice document content, Return lifecycle |
| `invoices` | Invoice drafts and issuance, immutable issued-document content, Credit Notes and invoice-level receivables projections | Payment transaction truth, Order lifecycle, direct receivable balance edits |
| `shipping` | External shipping booking, provider attempts and carrier status evidence | Order lifecycle, Return lifecycle, Payment truth |
| `returns` | Return request lifecycle, line quantities, receive evidence and resolution intent | Carrier execution and payment success truth |
| `commercial-evidence` | Append-only purchase evidence used by projections | Mutable payment/order state |
| `products` | Product catalog and product configuration | Sales-document lifecycle |
| `support` | Support case lifecycle | Customer identity ownership |
| `tasks` | Task/activity work queue and task lifecycle | Source record lifecycle |

The `customers` module is an official registered owner. Customer 360 is its read-side composition surface: it reads identity and downstream commercial evidence without taking ownership of those source records.

## 5. Identity and relationship model

The canonical buyer/relationship identity is a `Contact` or an `OrganizationAccount`.

```text
Contact
  = individual person identity

OrganizationAccount
  = B2B account identity

Customer
  = relationship-level lifecycle and care profile linked to a Contact or Organization Account

Customer 360
  = read-side composition across the Customer profile and downstream owners
```

A B2B Organization can link representative Contacts through canonical relationship references. The primary representative remains a Contact; person data is not embedded into the Organization aggregate.

Commercial records use buyer references. An Organization-owned commercial motion is resolved by an Organization buyer reference, not by treating a representative Contact as the B2B buyer owner.

Legacy Customer identifiers may exist as compatibility aliases for route continuity and migration. New writes resolve the official Customer profile and its canonical `RelationshipRef`; they must not create a second identity owner.

## 6. Lead qualification and commercial flow

Lead lifecycle uses separate work and outcome dimensions. Active business logic must not collapse these into one legacy status field.

The current qualification outcomes are coordinated by `src/workflows/lead-qualification/`:

- **Nurture** resolves a Contact/Organization relationship, creates a follow-up Task and closes the Lead with a revisit outcome.
- **Opportunity** resolves the relationship, validates opportunity entry criteria, creates a Deal and closes the Lead with an opportunity outcome.
- **Direct Sale** resolves the relationship and creates either a Quote or an Order without requiring a Deal.

The workflow owns orchestration only. The resulting records remain owned by their modules.

### Deal lifecycle

Deal state is owned by the Deal module.

- active Deals require a next action;
- terminal WON/LOST outcomes are explicit commands rather than automatic “next stage” transitions;
- WON requires accepted-Quote or confirmed-Order evidence;
- LOST requires a loss reason and recycle decision;
- a recyclable loss requires a revisit date.

### Quote lifecycle

Quote versions are owned by the Quote module.

- versions have a root quote identity;
- Deal-path Quotes require a Deal source;
- Direct-Sale Quotes must not require a Deal;
- sent and terminal versions are immutable in business content;
- changes to immutable versions require a revision.
- `acceptQuoteAndCloseDeal` accepts the Quote and closes its linked Deal as won when present; it never creates an Order.
- `convertAcceptedQuoteToOrderDraft` creates at most one DRAFT Order from an accepted Quote under a backend uniqueness lock.
- direct Order draft creation is a separate `createOrderDraftCommand`; generic Quote acceptance and generic lifecycle status mutation remain blocked.

### Order lifecycle

The canonical Order states are:

```text
DRAFT
CONFIRMED
COMPLETED
CANCELLED
```

Rules:

- the buyer is a Contact or Organization Account;
- generic state transition may move `DRAFT` to `CONFIRMED`;
- `COMPLETED` is owned by the Order Closing workflow;
- `CANCELLED` requires explicit audit information;
- Order does not own `paymentStatus`;
- Order does not own carrier/shipping execution state.

## 7. Cross-module workflows

A workflow belongs in `src/workflows/` only when one user or business operation coordinates multiple independent owners.

The repository contains 21 workflow boundaries:

- `contact-opportunity-creation`;
- `contact-organization-relationship`;
- `customer-care`;
- `customer-commercial-actions`;
- `customer-conversion`;
- `customer-identity`;
- `customer-onboarding`;
- `customer-relationship-integrity`;
- `deal-recycle`;
- `lead-qualification`;
- `order-cancellation`;
- `order-closing`;
- `order-confirmation`;
- `order-creation`;
- `order-shipping-booking`;
- `quote-acceptance`;
- `return-credit-refund`;
- `return-resolution`;
- `return-resolution-evidence`;
- `shipping-cod-evidence`;
- `work-activation`.

Every workflow has a stable root `index.ts`. A workflow with a `public/` directory also has `public/index.ts`. Root route-only entries use the `*-route.tsx` suffix and are imported only by application route assembly.

Workflow rules:

1. Import module public APIs only.
2. Do not create a duplicate aggregate.
3. Do not become a general shared service layer.
4. Keep domain/application logic framework-agnostic.
5. Make cross-owner side effects explicit and auditable.
6. Expose one workflow command for a multi-owner transaction; presentation must not reproduce its sequence.
7. In connected mode, backend authority validates concurrency, transaction and audit evidence.

Single-module commands stay inside that module.

## 8. Read models and projections

Workspace read models are read-side composition. They may join module-owned snapshots for user-facing views, but they do not gain write ownership.

Examples include:

- My Work;
- Notifications;
- Reports;
- Customer View;
- relationship timeline;
- CRM AI context.

A read model may subscribe to multiple module repositories. Writes must route back to the owning module or workflow.

Repository snapshot getters may return defensive copies. React subscriptions must use the subscription-driven adapter in `src/workspaces/crm/read-models/core/useRepositorySnapshot.ts`; direct `useSyncExternalStore` usage with fresh defensive snapshots would violate React's referential snapshot contract.

## 9. Customers module and legacy presentation compatibility

The official `customers` module owns Customer lifecycle, health, segmentation and care state. Its Customer 360 read model composes Contact/Organization identity and downstream module evidence through the canonical relationship.

Rules:

- Customer writes use the Customers module public commands;
- Contact and Organization remain the identity owners;
- Customer 360 does not copy Deal, Quote, Order, Payment, Shipping, Return, Support or Task ownership;
- any retained legacy presentation DTO is a narrow adapter around the official Customer model and read models;
- compatibility code must not spread into new module or workflow dependencies.

Removal of legacy presentation adapters is based on measurable criteria, not a calendar milestone. See `docs/architecture/compatibility-and-migration.md`.

## 10. Shipping and Returns boundaries

Shipping and Returns are independent owners.

### Shipping

`ShippingBooking` owns:

- source and purpose;
- provider attempt;
- booking status;
- external carrier status;
- tracking and provider references;
- immutable pickup/recipient/package snapshots;
- idempotency, attempt group and correlation data;
- delivery evidence (`deliveredAt`).

Booking status and external status are separate dimensions. Shipping never changes Order state by synchronizing a provider.

### Returns

`ReturnRequest` owns:

- returned Order line quantities;
- eligibility result;
- approval/rejection decision;
- actual receive confirmation;
- resolution intent and completion state.

A value-reducing Return or Exchange first waits for an issued Credit Note from Invoice ownership. Any cash refund then waits for a Payment Refund Intent/record owned by Payments. A positive Exchange delta waits for a provider-authoritative Payment Intent success before replacement Shipping is booked. Replacement completion waits for delivered Shipping evidence. Return does not manufacture Invoice, Payment or Shipping truth itself.

See `docs/business/shipping-and-returns.md`.

## 11. Product spaces, workspace context and shell

Canonical route form:

```text
/w/{workspaceKey}/{productSpace}/{relativePath}
```

Product spaces:

```text
crm
studio
people
```

The route context is parsed into workspace key, product space and relative path. Product-space guards validate access before rendering workspace route trees.

The shell is contextual:

- CRM shows CRM work navigation and the CRM-only AI utility;
- Studio shows the approved replacement settings navigation and preparation surfaces;
- People & Access shows member/role/permission/audit administration.

Workspace switching and shell links preserve canonical workspace scope.

## 12. Access control

Authorization is capability-based and workspace-scoped.

Current capability families cover:

- dashboard;
- leads;
- contacts;
- organizations;
- tasks;
- customer view;
- deals;
- quotes;
- orders;
- products;
- support;
- reports;
- payments;
- returns;
- shipping;
- Studio configuration;
- People & Access;
- audit.

Effective access is derived from:

```text
workspace membership
+ one or more role assignments
+ capabilities
+ data scopes
+ field security
```

Suggested roles are onboarding templates, not immutable authorization identities. A workspace may create, rename, duplicate, deactivate, or delete roles as long as assigned members are reallocated and at least one active membership retains `access.configure`. Shell visibility and command authorization must never branch on role names. Multiple assigned roles union capabilities while field security uses the most restrictive applicable policy. People & Access mutations enforce `access.configure` at the application command boundary. Future Studio mutations must enforce `studio.configure` through backend commands rather than UI-only checks.

## 13. Routing and lazy-load runtime

All route trees are wrapped with route-local screen boundaries.

The route runtime provides:

- a 15-second lazy-module timeout;
- expected-export validation;
- route-specific load errors;
- pathname/search-based error-boundary reset;
- product-space-aware recovery destinations.

The app uses `HashRouter` with transition deferral disabled because the current React 19 + lazy route runtime requires synchronous HashRouter location propagation.

Route matching must be explicit. A wildcard route must not mask an unknown path by rendering Dashboard.

## 14. Presentation contracts

### List pages

Shared list archetype responsibilities include:

- page header and actions;
- search/filter toolbar;
- loading/empty/error states;
- permission-aware bulk or create actions;
- stable table/card presentation where appropriate.

### Detail pages

Shared detail archetype responsibilities include:

- record header;
- status and identity context;
- responsive tab navigation;
- explicit related-record sections;
- permission-aware actions.

### Forms and dialogs

Shared modal sizing is based on complexity:

```text
1–4 controls   → sm (520 px)
5–20 controls  → md (840 px)
21+ controls   → lg (1200 px)
```

Dense nested Lead forms and Product Picker use the large composition even when raw native-control counts understate the visual complexity.

Order, Return and Support full-page forms use the shared page-form archetype. Quote Builder keeps a wider transaction canvas.

See `docs/quality/form-and-presentation-contracts.md`.

## 15. Studio configuration boundary

The previous Studio implementation, browser control-plane repository, configuration simulations and page-specific schemas have been removed. They are not a baseline for the replacement.

The current frontend provides:

- the `studio` product-space route shell;
- one navigation registry with optional Quick Setup and ten detailed sections, with no Overview page;
- permission-guarded lazy routes;
- direct settings screens built from forms, lists, tables and inline pipeline editing;
- module-owned configuration repositories with revision metadata;
- browser-only demo adapters and six generated configuration clients for connected backend authority;
- focused guards for single authority, Quick Setup, module propagation, currencies/exchange rates, API contract and v1 removal;
- the canonical roadmap in `docs/product/studio-rebuild-roadmap.md`.

Studio is limited to workspace settings: Quick Setup metadata, business information/address book, locale/currencies/exchange rates, enabled features, pipelines/statuses, business-owned product types, CRM information fields, payment/invoice information, integrations and webhooks/API. Studio owns no copied business answers. The backend is the configuration authority in connected mode; browser repositories are non-authoritative local demo adapters.

People, roles, permissions and access audit remain owned by People & Access. CRM operational workflows remain owned by their CRM modules and backend commands rather than by Studio settings.

## 16. Persistence and migration

Browser-oriented repositories are used by the current frontend runtime. Storage keys and snapshot schemas are compatibility contracts and must not be changed casually.

Rules:

- use schema-aware migration for persisted snapshots;
- preserve unrelated role, scope and field-security choices during access-control migration;
- persist migrated snapshots back under the established key when compatibility requires it;
- keep migration preview/backfill code under `src/migrations/`;
- do not import migration-only code into runtime modules;
- use deterministic identifiers for committed backfills where required.

See `docs/architecture/compatibility-and-migration.md`.

## 17. Quality enforcement

The repository uses several layers of verification:

- TypeScript type checking;
- repository naming and documentation guards;
- architecture dependency guards;
- route-module load audit;
- form runtime and sizing audit;
- focused business invariant tests;
- navigation and access-control migration checks;
- production build.

The current `package.json` is authoritative for command names. Historical documentation is not used as an executable contract.

See `docs/quality/verification.md`.

## 18. Non-negotiable invariants

1. Customers is an official module; Customer 360 is read-side composition and Contact/Organization remain identity owners.
2. Contact owns person identity; Organization owns B2B account identity.
3. Lead qualification resolves canonical relationships before creating downstream records.
4. Deal owns opportunity state.
5. Quote owns quote versions and immutable sent/terminal content.
6. Order does not own payment or shipping execution state.
7. Payment owns refund success.
8. Shipping owns carrier booking and delivery evidence.
9. Return completion waits for evidence from the relevant owner.
10. Commercial Evidence is append-only.
11. Cross-module workflows use public APIs only.
12. Workspace read models do not write business state.
13. Shell visibility derives from capabilities, not role-name branching.
14. Migration-only code never becomes a runtime dependency.
15. Historical delivery terminology is not an architecture taxonomy.

## Dependency direction

Module code follows `presentation → public/application → application → domain`. Concrete browser, storage, provider, and HTTP implementations remain under `infrastructure`, while module-local `runtime` files own temporary browser-backed wiring. Domain, application, and presentation layers must not import `infrastructure` or `runtime`. See `docs/architecture/dependency-boundaries.md`.

## Application composition

Deployment mode and connected identity/API requirements are resolved by `src/app/bootstrap/applicationBootstrap.ts`; concrete browser and connected adapters are selected only by `src/app/composition/applicationComposition.ts`. See `docs/architecture/application-composition.md` and `docs/architecture/backend-readiness.md`.

EXTERNAL capability modes use a workspace-scoped backend provider-health authority. The UI remains blocked until it receives a valid decision, and distinguishes healthy read-only synchronization, degraded or delayed data, authentication expiry, reconciliation requirements, provider outage and missing configuration. See `docs/architecture/external-authority-health.md`.

Connected Payment, Invoice and Receivables adapters share `src/platform/api`. The transport owns access-token/workspace context, trace headers, timeout, retry, serialization and typed API errors. Module adapters own endpoint paths and must not call `fetch` directly. See `docs/architecture/http-api-foundation.md`.

Connected list surfaces use server-side search/filter/sort and cursor paging. Deal Kanban uses bounded per-stage windows with independent cursors and loaded/total counts, rather than loading the full pipeline. See `docs/architecture/server-side-list-query.md` and `docs/architecture/deal-stage-window-query.md`.

The public entry lazy-loads authentication screens and the authenticated CRM shell. Production builds emit a Vite manifest and fail when any JavaScript chunk exceeds 500 KiB minified. See `docs/architecture/code-splitting-and-bundle-budget.md`.

- Error handling uses the shared `ApplicationError` taxonomy, code/category-based control flow, operator-safe `userMessage`, and recovery actions documented in `docs/architecture/error-handling.md`.

## Quality pipeline ownership

The deterministic repository pipeline is owned by `scripts/quality/quality-pipeline.json`. Gates are grouped by lint, typecheck, architecture, unit, contract, integration, route smoke, critical E2E and production build. Each gate has one group owner; any excluded check/test command must have a concrete reason in the manifest.

`npm run verify` executes the manifest in order and includes the production build. Node-based gates run through an isolated module wrapper so completed assertions cannot be held open by unrelated listeners or timers. See `docs/quality/quality-pipeline.md`.

## Backend-authoritative audit viewer

Connected Mode binds a workspace-scoped audit authority at `/audit/events`. The shared viewer is separate from Activity/Task/Note timelines, validates workspace/resource/record ownership, redacts sensitive payload keys, and exposes request/correlation/causation identifiers plus approval, automation, integration and provider evidence. Deal, Quote and Order use a lazy shell host; Payment, Invoice and Return use the embedded viewer; Studio and People & Access use workspace/configuration scope. Demo Mode remains explicitly browser-level evidence only. See `docs/architecture/backend-authoritative-audit-viewer.md`.

### Contact–Organization relationship ledger

A Contact is the person identity and may hold multiple Organization Account memberships. `Contact.organizationRelationships` is the canonical effective-dated ledger for organization, relationship role, job title, department, decision role and primary-representative evidence. Legacy `organizationAccountId` and related fields are compatibility projections only. Cross-module writes use the `contact-organization-relationship` workflow so Contact membership, Organization active references and primary uniqueness change in one authoritative transaction. See `docs/architecture/contact-organization-relationships.md`.
