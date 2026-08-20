# Unicore CRM documentation

These documents describe the current frontend system, target backend-facing contracts, quality rules and acceptance trackers. Every document is classified in the machine-readable [document status manifest](./document-status.json). For operations present in `api/openapi.json`, OpenAPI is the canonical API-contract candidate. Other endpoint examples remain non-authoritative target inventories.

Status labels:

- **CURRENT** — verified description of the present source.
- **TARGET** — intended design; not proof of implementation.
- **TRACKER** — implementation/acceptance work list containing both completed and pending items.
- **REFERENCE** — supporting model or example, not the sole authority.

## Release and decision authority

- [Frontend contract release identity](quality/release-identity.md) — CURRENT
- [Connected backend acceptance evidence](quality/connected-backend-acceptance.md) — CURRENT
- [Architecture decision records](architecture/decisions/README.md) — CURRENT
- [Compatibility retirement ledger](architecture/compatibility-ledger.md) — CURRENT
- [Stage 6 compatibility retirement](architecture/compatibility-retirement-stage6.md) — CURRENT
- [Stage 7 large-file and presentation responsibility](architecture/large-file-presentation-responsibility-stage7.md) — CURRENT

## Backend contract hardening

- [Backend-readiness contract authority](backend-readiness/README.md) — CURRENT
- [P0.2 transaction semantics](backend-readiness/p02-transaction-semantics.md) — CURRENT
- [P0.3 authoritative commercial read models](backend-readiness/p03-commercial-read-models.md) — CURRENT
- [Credit approval command decision](backend-readiness/credit-approval-command-decision.md) — CURRENT
- [Accepted Quote to Order decision](backend-readiness/quote-order-conversion-decision.md) — CURRENT
- [Quote and Order transaction contract](backend-readiness/quote-order-transaction-contract.md) — CURRENT
- [Payment financial-effects decisions](backend-readiness/payment-financial-effects-decisions.md) — CURRENT
- [Transaction provider contract pack](backend-readiness/transaction-provider-contract-pack.md) — CURRENT
- [Command registry](backend-readiness/command-registry.md) — CURRENT
- [Query registry](backend-readiness/query-registry.md) — CURRENT
- [Operation authorization matrix](backend-readiness/operation-authorization-matrix.md) — CURRENT

## API contract

- [OpenAPI authority and generated client](api/README.md) — CURRENT
- [OpenAPI 3.1 machine contract](api/openapi.json) — CURRENT, canonical candidate
- [API contract and generated-client architecture](architecture/api-contract-and-generated-client.md) — CURRENT
- [.NET modular-monolith and SQL Server target](architecture/dotnet-sqlserver-backend-target.md) — TARGET

## Architecture

- [Dependency boundaries](architecture/dependency-boundaries.md) — CURRENT
- [Application composition and replaceable adapters](architecture/application-composition.md) — CURRENT
- [Frontend-to-backend readiness boundary](architecture/backend-readiness.md) — CURRENT
- [HTTP and API foundation](architecture/http-api-foundation.md) — CURRENT
- [Effective record access authority](architecture/effective-record-access.md) — CURRENT
- [Contact–Organization relationship ledger](architecture/contact-organization-relationships.md) — CURRENT
- [Server-side list query runtime](architecture/server-side-list-query.md) — CURRENT
- [Deal Kanban stage-window query](architecture/deal-stage-window-query.md) — CURRENT
- [Entry code splitting and bundle budget](architecture/code-splitting-and-bundle-budget.md) — CURRENT
- [Reference financial vertical slice](architecture/reference-financial-vertical-slice.md) — REFERENCE
- [Mutation command authority and state transitions](architecture/mutation-command-authority.md) — CURRENT
- [Record retention and destructive actions](architecture/record-retention-and-destructive-actions.md) — CURRENT
- [Presentation responsibility](architecture/presentation-responsibility.md) — CURRENT
- [Type safety and strictness](architecture/type-safety-and-strictness.md) — CURRENT
- [Error taxonomy and UI handling](architecture/error-handling.md) — CURRENT
- [Module ownership and workflows](architecture/module-ownership-and-workflows.md) — CURRENT
- [Routing, shell and access control](architecture/routing-shell-and-access-control.md) — CURRENT
- [Compatibility and migration](architecture/compatibility-and-migration.md) — CURRENT
- [Data defaults and demo runtime ownership](architecture/data-defaults-and-demo-runtime.md) — CURRENT
- [Type ownership and boundary contracts](architecture/type-ownership.md) — CURRENT

## Business boundaries

- [Customer relationship and commercial flow](business/customer-relationship-and-commercial-flow.md) — CURRENT
- [Metric catalog and reporting](business/metric-catalog-and-reporting.md) — CURRENT
- [Sales Quick Create and pipeline health](business/sales-quick-create-and-pipeline-health.md) — CURRENT
- [Role-based navigation and product language](business/role-based-navigation-and-product-language.md) — CURRENT
- [Enterprise security and resilience](business/enterprise-security-and-resilience.md) — TARGET
- [Pilot end-to-end acceptance](business/pilot-end-to-end-acceptance.md) — TRACKER
- [Deployment operations, forecast and AI governance](business/deployment-operations-forecast-and-ai-governance.md) — CURRENT
- [Shipping and returns](business/shipping-and-returns.md) — CURRENT
- [Order-to-Cash operations](business/order-to-cash-operations.md) — CURRENT
- [Order-to-Cash frontend build specification](business/order-to-cash-frontend-build-spec.md) — TARGET
- [Payment plans and collections frontend specification](business/payment-plans-and-collections-frontend-spec.md) — TARGET

## Product and AI guidance

- [Guidance system and maintenance contract](product/guidance-system.md) — CURRENT
- [Guided-screen inventory (65 contextual screens)](product/guidance-screen-inventory.md) — CURRENT
- [AI skills and ownership guidance](ai/SKILLS.md) — CURRENT

## Quality contracts

- [Form and presentation contracts](quality/form-and-presentation-contracts.md) — CURRENT
- [Verification](quality/verification.md) — CURRENT
- [Quality pipeline](quality/quality-pipeline.md) — CURRENT
- [Repository inventory and cleanup baseline](quality/repository-inventory.md) — CURRENT, generated
- [Machine-readable repository inventory](quality/repository-inventory.json) — CURRENT, generated
- [Source packaging](quality/source-packaging.md) — CURRENT
- [Backend-readiness verification](quality/backend-readiness-verification.md) — CURRENT
- [API contract verification](quality/api-contract-verification.md) — CURRENT

The top-level [architecture constitution](../ARCHITECTURE.md) defines repository-wide dependency rules and non-negotiable invariants.

- [Studio rebuild roadmap](product/studio-rebuild-roadmap.md) — CURRENT

- [CI and source release contract](./quality/ci-and-release.md)
