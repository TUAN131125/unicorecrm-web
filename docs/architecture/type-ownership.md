# Type Ownership and Boundary Contracts

This document defines where TypeScript contracts belong and replaces the retired root-level business type barrel.

## Ownership rules

- Domain entities, value objects and lifecycle types belong to the module that owns the business truth.
- Application commands, queries and ports belong to the owning module's `application/` layer.
- Workspace-level configuration contracts belong to `src/platform/workspace-config/`.
- Presentation-only table, form and view-model types belong beside the presentation feature that consumes them.
- Shared technical primitives must have a named shared/platform owner; they are not collected into a global business barrel.
- Consumers import from the owning module public boundary or the explicit owner file. They do not import `@/types`.
- DTOs, domain entities, form values and view models must not be collapsed into one interface merely for convenience.

## Current canonical owners

| Contract | Canonical owner |
|---|---|
| Workspace CRM configuration and module visibility | `src/platform/workspace-config/workspaceConfig.types.ts` |
| Workspace terminology helpers | `src/platform/workspace-config/workspaceTerminology.ts` |
| Lead entity and lifecycle | `src/modules/leads/domain/model/` |
| Lead list/table column identifiers | `src/modules/leads/presentation/model/leadTable.types.ts` |
| Contact entity | `src/modules/contacts/domain/model/contact.types.ts` |
| Customer lifecycle aggregate | `src/modules/customers/domain/model/customer.types.ts` |
| Customer presentation read model | `src/modules/customers/presentation/model/customerDisplay.types.ts` |
| Deal entity and stages | `src/modules/deals/domain/model/deal.types.ts` |
| Quote entity and pricing contracts | `src/modules/quotes/domain/model/quote.types.ts` |
| Product catalog entity | `src/modules/products/domain/model/product.types.ts` |
| Support case entity | `src/modules/support/domain/model/supportCase.types.ts` |
| Cross-record CRM activity shape | `src/shared/domain/crmActivity.ts` |

The Customer presentation read model is deliberately distinct from the canonical Customer lifecycle aggregate. Workspace configuration uses its own `WorkspaceCustomerType` archetype and does not declare another Customer aggregate.

## Import examples

Approved:

```text
presentation -> module public type export
workspace configuration runtime -> workspaceConfig.types.ts
Lead table hooks -> leadTable.types.ts
workflow port -> explicit shared activity contract
```

Rejected:

```text
module -> @/types
form values used as server/domain entities
workspace configuration declared inside a React page
business entities re-exported through a root catch-all barrel
```

## Verification

```bash
npm run quality:gate -- --gate quality.global-type-boundaries
```

The gate protects removal of the root type barrel and forwarding directories, rejects imports from `@/types`, requires the current canonical owner files and prevents Workspace Config from declaring a parallel Customer aggregate.
