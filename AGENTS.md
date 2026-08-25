# Repository Guidance

Read `README.md` and `ARCHITECTURE.md` before changing architecture.

Dependency direction:

```text
src/app
→ src/workspaces
→ src/workflows
→ src/modules
→ src/shared + src/platform
```

This is a frontend-only repository. The production backend is a separate ASP.NET Core modular-monolith solution. Shared transport authority comes from OpenAPI and generated frontend clients, not copied frontend domain types.

Do not bypass module public APIs when an appropriate public boundary exists. Every module exposes cross-boundary contracts through `public/index.ts`; its root `index.ts` exports only the manifest and public barrel. Module code must never import from `src/app/`.

Do not restore removed modules or surfaces:

```text
acquisition
care
fulfillment
renewals
```

Protected repository inventory:

```text
15 registered modules
79 route keys
63 loadable route modules
123 capabilities
13 workspace module flags
22 cross-module workflows
```

`docs/quality/repository-inventory.json` is the machine-readable structural inventory. Regenerate it with `npm run repo:inventory` after an intentional structural change and protect it with `npm run repo:check`.

Do not change route, capability, workspace flag, storage contract, or business state machine behavior outside the task scope.

Do not create files, names, or comments using delivery chronology markers such as:

```text
PCR
Wave
Batch
Hotfix
Rootfix
Implementation Summary
Refactor Progress
```

Do not create root Markdown worklogs.

Do not edit tests just to make them pass.

Presentation responsibility contract:

```text
Keep protected page/form entrypoints thin.
Move route/application interaction logic into render-free controller hooks.
Move workspace markup into dedicated views and focused sections.
Use scripts/lib/presentationCompositionSource.mts for source-level contracts that validate a composed screen.
Run npm run quality:gate -- --gate quality.presentation-responsibility after changing protected presentation surfaces.
```


Mutation authority contract:

```text
Use module or named workflow command boundaries for lifecycle changes.
Presentation must await MutationOutcome and must not call synchronous snapshot transition functions.
Carry stable idempotency keys and expected versions where applicable.
Multi-owner effects belong to one workflow command; do not sequence aggregate writes in React.
Run `npm run quality:gate -- --gate quality.mutation-command-authority` after changing lifecycle behavior.
Run `npm run quality:gate -- --gate quality.record-retention-policy` after changing archive, anonymize, cancel, void or delete behavior.
```

Type-safety contract:

```text
Keep `tsconfig.json` globally strict.
Backend-facing shared boundaries also use exact optional properties and unchecked indexed-access protection.
Do not add explicit any, as-any assertions, non-null assertions or TypeScript suppressions under protected strict regions.
Run `npm run quality:gate -- --gate quality.strict-core` and `npm run quality:gate -- --gate quality.strict-type-regions` after changing application, HTTP, money or Order-to-Cash contracts.
The repository-wide type-safety budget may decrease but must not increase.
```

API contract maintenance contract:

```text
Treat docs/api/openapi.json as authority for every operation it declares.
Do not hand-edit src/platform/api/generated files or duplicate generated paths in adapters.
Keep generated DTOs out of presentation and module application/domain layers.
Run npm run api:generate after an intentional OpenAPI change.
Run npm run api:check, npm run quality:gate -- --gate quality.api-management-boundaries and npm run quality:gate -- --gate quality.strict-core before completion.
```

Backend-target maintenance contract:

```text
Keep the frontend transport boundary technology-neutral.
Do not add an executable backend, database driver, ORM or backend migration to this frontend repository.
Derive actor identity, workspace membership and authoritative time on the future server, never from frontend payload claims.
The selected target is ASP.NET Core Modular Monolith + Clean Architecture + CQRS/MediatR + FluentValidation + SQL Server.
Run npm run quality:gate -- --gate quality.frontend-backend-separation, npm run quality:gate -- --gate quality.backend-readiness and npm run api:check before completion.
```

Order-to-Cash maintenance contract:

```text
Read docs/ai/SKILLS.md, docs/business/order-to-cash-frontend-build-spec.md, and docs/business/payment-plans-and-collections-frontend-spec.md before changing Quote, Order, Payment, Invoice, Receivables, Shipping, COD, Return, Credit Note, refund, allocation, or customer-credit behavior.
Do not treat browser state, redirect parameters, local calculations, or toast messages as durable financial truth.
```

Guidance maintenance contract:

```text
Read docs/product/guidance-system.md before changing any route, menu, form, modal, drawer, action, field, validation, permission, lifecycle, empty state, message, or data-guidance-id.
Update route metadata, bilingual guidance content, walkthrough targets, field help, workflow guidance, and guidance version in the same change when affected.
Run npm run quality:gate -- --gate quality.guidance-contracts before completion.
```

Quality pipeline contract:

```text
Use scripts/quality/quality-pipeline.json as the single full-pipeline authority.
Assign each deterministic gate to exactly one group or document an explicit exclusion.
Use npm run verify for complete verification; it includes the production build.
Use focused group commands during development, then run npm run quality:gate -- --gate quality.quality-pipeline after changing package scripts or verification ownership.
Do not restore a long verify:gates shell chain.
```

Known pre-existing debt must not be mixed into unrelated tasks:

```text
main bundle > 500 kB
```

Task completion flow:

```text
focused quality group
npm run quality:gate -- --gate quality.quality-pipeline
npm run repo:check
npm run verify
review git diff and git status
```

Do not claim browser E2E PASS unless browser E2E actually ran.
Before creating or delivering any source archive, read and follow `docs/quality/source-packaging.md`.

- Never branch on `error.message` or render raw server diagnostics. Use `ApplicationError`, stable codes/categories, and `presentApplicationError`/`formatApplicationError`.

## Imported Claude Cowork project instructions
