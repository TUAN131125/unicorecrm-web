# Repository Inventory and Cleanup Baseline

## Purpose

This document is generated from the repository and records the structural baseline used to protect behavior while cleanup work proceeds. The JSON source of truth is `docs/quality/repository-inventory.json`.

Regenerate and verify it with:

```bash
npm run repo:inventory
npm run repo:check
```

Do not delete a dead, compatibility, deprecated or duplicate candidate based on this inventory alone. Confirm runtime, lazy-route, test, script, migration and documentation consumers first.

## Summary

| Metric | Count |
|---|---:|
| Repository files | 2077 |
| Source files | 1385 |
| Source lines | 213103 |
| Registered modules | 15 |
| Route keys | 80 |
| Loadable route modules | 64 |
| Capabilities | 131 |
| Workspace module flags | 13 |
| Cross-module workflows | 23 |
| Public boundary files | 107 |
| Persistence entries | 3013 |
| Repository/store/adapter files | 146 |
| Compatibility candidates | 53 |
| Dead-code candidates | 0 |
| Large source files (â‰¥ 500 lines) | 44 |
| Circular dependency groups | 0 |
| Package scripts | 23 |
| Quality groups | 11 |
| Verify gates | 339 |

Inventory fingerprint: `d7477fd3818f04b4b2d52e1a5fe19462723f4ca70fa363a5e6f0eeea59f315c3`


## Quality pipeline

| Group | Gates |
|---|---:|
| `lint` | 1 |
| `typecheck` | 3 |
| `architecture` | 66 |
| `unit` | 32 |
| `contract` | 64 |
| `integration` | 49 |
| `route-smoke` | 8 |
| `critical-e2e` | 5 |
| `backend-contract-hardening` | 90 |
| `build` | 1 |
| `acceptance` | 20 |

## File classification

| Classification | Count |
|---|---:|
| `active-runtime` | 1301 |
| `active-script` | 80 |
| `active-test` | 446 |
| `compatibility` | 53 |
| `documentation` | 192 |
| `fixture` | 3 |
| `generated` | 2 |

A file has one primary classification and separate reachability flags in the JSON manifest. `dead-candidate` means only that no runtime, test or script path was found by the current static graph; it is not permission to delete the file.

## Registered modules

| Module | Workspace | Manifest routes | Manifest |
|---|---|---:|---|
| `commercial-evidence` | crm | 0 | `src/modules/commercial-evidence/manifest.ts` |
| `contacts` | crm | 2 | `src/modules/contacts/manifest.ts` |
| `customers` | crm | 4 | `src/modules/customers/manifest.ts` |
| `deals` | crm | 2 | `src/modules/deals/manifest.ts` |
| `invoices` | crm | 7 | `src/modules/invoices/manifest.ts` |
| `leads` | crm | 6 | `src/modules/leads/manifest.ts` |
| `orders` | crm | 4 | `src/modules/orders/manifest.ts` |
| `organizations` | crm | 2 | `src/modules/organizations/manifest.ts` |
| `payments` | crm | 2 | `src/modules/payments/manifest.ts` |
| `products` | crm | 2 | `src/modules/products/manifest.ts` |
| `quotes` | crm | 5 | `src/modules/quotes/manifest.ts` |
| `returns` | crm | 3 | `src/modules/returns/manifest.ts` |
| `shipping` | crm | 3 | `src/modules/shipping/manifest.ts` |
| `support` | crm | 4 | `src/modules/support/manifest.ts` |
| `tasks` | crm | 2 | `src/modules/tasks/manifest.ts` |

## Cross-module workflows

- `src/workflows/accepted-quote-order-conversion`
- `src/workflows/contact-opportunity-creation`
- `src/workflows/contact-organization-relationship`
- `src/workflows/customer-care`
- `src/workflows/customer-commercial-actions`
- `src/workflows/customer-conversion`
- `src/workflows/customer-identity`
- `src/workflows/customer-onboarding`
- `src/workflows/customer-relationship-integrity`
- `src/workflows/deal-recycle`
- `src/workflows/lead-customer-conversion`
- `src/workflows/lead-qualification`
- `src/workflows/order-cancellation`
- `src/workflows/order-closing`
- `src/workflows/order-confirmation`
- `src/workflows/order-creation`
- `src/workflows/order-shipping-booking`
- `src/workflows/quote-acceptance`
- `src/workflows/return-credit-refund`
- `src/workflows/return-resolution`
- `src/workflows/return-resolution-evidence`
- `src/workflows/shipping-cod-evidence`
- `src/workflows/work-activation`

## Critical journeys

| Journey | Description | Owners | Evidence | Verification commands |
|---|---|---|---|---|
| `lead.create` | Create Lead | `leads` | Ready | `npm run quality:gate -- --gate quality.lead-business-rules-contracts`<br>`npm run quality:gate -- --gate quality.sales-quick-create-contracts` |
| `lead.qualify-to-deal` | Qualify Lead to Deal | `leads`, `deals`, `lead-qualification` | Ready | `npm run quality:gate -- --gate quality.lead-lifecycle-contracts`<br>`npm run quality:gate -- --gate quality.pilot-end-to-end` |
| `quote.create` | Create Quote | `quotes` | Ready | `npm run quality:gate -- --gate quality.quotes`<br>`npm run quality:gate -- --gate quality.quote-presentation-contracts` |
| `quote.accept` | Accept Quote | `quotes` | Ready | `npm run quality:gate -- --gate quality.quote-approval-delivery-contracts`<br>`npm run quality:gate -- --gate quality.quote-order-integrity-contracts` |
| `order.confirm` | Confirm Order | `orders`, `payments`, `order-confirmation` | Ready | `npm run quality:gate -- --gate quality.order-creation-contracts`<br>`npm run quality:gate -- --gate quality.order-operations-frontend-contracts` |
| `invoice.issue` | Issue Invoice | `invoices` | Ready | `npm run quality:gate -- --gate quality.invoice-domain-contracts`<br>`npm run quality:gate -- --gate quality.order-to-cash-api-contracts` |
| `payment.record` | Record Payment | `payments` | Ready | `npm run quality:gate -- --gate quality.payment-workflow-contracts`<br>`npm run quality:gate -- --gate quality.payment-allocation-contracts` |
| `shipping.book` | Create Shipping Booking | `shipping`, `order-shipping-booking` | Ready | `npm run quality:gate -- --gate quality.shipping-create-page-contracts`<br>`npm run quality:gate -- --gate quality.shipping-returns-contracts` |
| `return.process` | Process Return | `returns`, `shipping`, `payments` | Ready | `npm run quality:gate -- --gate quality.shipping-returns-contracts`<br>`npm run quality:gate -- --gate quality.return-credit-refund-contracts` |
| `support.manage-case` | Create and Process Support Case | `support` | Ready | `npm run quality:gate -- --gate quality.support`<br>`npm run quality:gate -- --gate quality.work-operations-ux` |
| `task.create-related` | Create Related Task | `tasks`, `work-activation` | Ready | `npm run quality:gate -- --gate quality.work-operations-ux`<br>`npm run quality:gate -- --gate quality.record-ownership-contracts` |

The journey table locks source evidence and executable command names. Actual command results remain runtime verification evidence and are not stored as permanent logs in the source package.

## Persistence ownership

| Owner | Entries |
|---|---:|
| `commercial-evidence` | 1 |
| `contacts` | 2 |
| `customers` | 2 |
| `deals` | 6 |
| `feature:auth` | 3 |
| `invoices` | 6 |
| `leads` | 8 |
| `orders` | 4 |
| `organizations` | 2 |
| `payments` | 7 |
| `platform:access-control` | 46 |
| `platform:api` | 2823 |
| `platform:audit` | 4 |
| `platform:configuration-runtime` | 3 |
| `platform:developer-configuration` | 3 |
| `platform:integrations` | 1 |
| `platform:notifications` | 2 |
| `platform:workspace-config` | 4 |
| `platform:workspace-context` | 1 |
| `platform:workspace-membership` | 1 |
| `products` | 3 |
| `quotes` | 5 |
| `returns` | 8 |
| `shared:app` | 11 |
| `shared:i18n` | 4 |
| `shipping` | 3 |
| `support` | 3 |
| `tasks` | 2 |
| `test` | 5 |
| `workspace:people-access` | 39 |
| `workspace:studio` | 1 |

The JSON manifest includes each detected key pattern, operation, path, line and browser-global signal. Dynamic key templates are recorded as patterns.

## Large source files

| File | Lines | Owner |
|---|---:|---|
| `src/platform/api/catalog/generatedApiOperationCatalog.ts` | 32466 | `platform:api` |
| `src/platform/api/generated/commercialApi.ts` | 6034 | `platform:api` |
| `src/i18n/translations/en.ts` | 4989 | `shared:i18n` |
| `src/i18n/translations/vi.ts` | 4989 | `shared:i18n` |
| `src/i18n/types.ts` | 2036 | `shared:i18n` |
| `src/platform/api/generated/financialApi.ts` | 1757 | `platform:api` |
| `src/modules/contacts/presentation/hooks/useContactDetailController.tsx` | 1272 | `contacts` |
| `src/modules/leads/presentation/pages/LeadListPage.tsx` | 1245 | `leads` |
| `src/modules/deals/presentation/pages/DealPipelinePage.tsx` | 1233 | `deals` |
| `src/modules/contacts/presentation/hooks/useContactListController.tsx` | 1179 | `contacts` |
| `src/modules/quotes/presentation/views/QuoteBuilderView.tsx` | 1106 | `quotes` |
| `src/modules/quotes/presentation/pages/QuoteListPage.tsx` | 1103 | `quotes` |
| `src/modules/leads/presentation/views/LeadDetailView.tsx` | 1077 | `leads` |
| `src/modules/quotes/presentation/hooks/useQuoteBuilderController.tsx` | 997 | `quotes` |
| `src/modules/deals/presentation/hooks/useDealPipelineController.ts` | 966 | `deals` |
| `src/modules/orders/presentation/hooks/useOrderFormController.tsx` | 935 | `orders` |
| `src/modules/leads/presentation/components/LeadFormView.tsx` | 924 | `leads` |
| `src/modules/quotes/presentation/pages/QuoteDetailPage.tsx` | 854 | `quotes` |
| `src/i18n/legacyUiCopy.ts` | 832 | `shared:i18n` |
| `src/modules/orders/presentation/views/OrderListView.tsx` | 812 | `orders` |
| `src/modules/orders/presentation/pages/OrderDetailPage.tsx` | 730 | `orders` |
| `src/guidance/content/crm/extendedScreens.ts` | 701 | `shared:guidance` |
| `src/modules/organizations/presentation/pages/OrganizationAccountDetailPage.tsx` | 695 | `organizations` |
| `src/modules/products/presentation/pages/ProductDetailPage.tsx` | 695 | `products` |
| `src/modules/leads/infrastructure/http/LeadHttpCommandAdapter.ts` | 692 | `leads` |
| `src/modules/leads/presentation/hooks/useLeadDetailController.tsx` | 667 | `leads` |
| `src/modules/leads/presentation/hooks/useLeadFormController.tsx` | 649 | `leads` |
| `src/modules/customers/presentation/detail/CustomerOverviewTab.tsx` | 640 | `customers` |
| `src/modules/products/presentation/components/ProductFormModal.tsx` | 637 | `products` |
| `src/modules/payments/presentation/pages/PaymentOperationsPage.tsx` | 634 | `payments` |

## Circular dependency groups

- None detected.

## Compatibility candidates

- `src/app/router/adapters/lead-qualification/LegacyLeadConvertRedirect.tsx`
- `src/i18n/legacyUiCopy.ts`
- `src/i18n/LegacyUiTranslationBridge.tsx`
- `src/migrations/canonical-v1/commercialEvidenceMigration.ts`
- `src/migrations/canonical-v1/customerMigrationPreview.ts`
- `src/migrations/canonical-v1/customerRelationshipMigration.records.ts`
- `src/migrations/canonical-v1/customerRelationshipMigration.ts`
- `src/migrations/canonical-v1/dealQuoteNormalization.ts`
- `src/migrations/canonical-v1/index.ts`
- `src/migrations/canonical-v1/leadMigrationPreview.ts`
- `src/migrations/canonical-v1/migrationIssues.ts`
- `src/modules/commercial-evidence/infrastructure/purchaseEvidence.seed.ts`
- `src/modules/contacts/domain/model/contact.types.ts`
- `src/modules/contacts/infrastructure/contact.mock.ts`
- `src/modules/contacts/presentation/hooks/useContactDetailController.tsx`
- `src/modules/customers/application/queries/customerRelationshipDataQuality.ts`
- `src/modules/customers/infrastructure/customerMigration.seed.ts`
- `src/modules/customers/presentation/customerPresentationHelpers.ts`
- `src/modules/customers/presentation/detail/CustomerDetailInfoTab.tsx`
- `src/modules/customers/presentation/detail/CustomerWorkspace.tsx`
- `src/modules/customers/presentation/model/customerDisplay.types.ts`
- `src/modules/deals/domain/model/deal.types.ts`
- `src/modules/deals/presentation/hooks/useDealDetailController.tsx`
- `src/modules/invoices/application/ports/InvoiceApiPort.ts`
- `src/modules/invoices/domain/model/invoice.types.ts`
- `src/modules/leads/infrastructure/http/LeadModuleDataAuthorityBridge.ts`
- `src/modules/leads/manifest.ts`
- `src/modules/leads/public/leads.ts`
- `src/modules/orders/domain/model/order.types.ts`
- `src/modules/orders/domain/rules/orderLifecycle.ts`
- `src/modules/orders/infrastructure/InMemoryOrderRepository.ts`
- `src/modules/organizations/infrastructure/organizationAccount.seed.ts`
- `src/modules/payments/infrastructure/payment.seed.ts`
- `src/modules/payments/presentation/pages/PaymentDetailPage.tsx`
- `src/modules/products/domain/model/product.types.ts`
- `src/modules/products/infrastructure/productConfiguration.store.ts`
- `src/modules/quotes/domain/model/quote.types.ts`
- `src/modules/quotes/domain/rules/quoteCalculations.ts`
- `src/modules/quotes/presentation/pages/QuoteDetailPage.tsx`
- `src/modules/shipping/infrastructure/shippingBookingSnapshot.ts`
- `src/modules/support/domain/model/supportCase.types.ts`
- `src/platform/access-control/runtime/accessControlRuntime.ts`
- `src/platform/api/contracts/generatedOpenApiRuntimeContract.ts`
- `src/platform/configuration-runtime/types.ts`
- `src/platform/identity-auth/runtime/authRuntime.ts`
- `src/platform/persistence/BrowserStorageAdapter.ts`
- `src/platform/workspace-membership/domain/workspaceMembership.types.ts`
- `src/shared/components/ui/Button.tsx`
- `src/shared/components/ui/PageHeader.tsx`
- `src/shared/order-to-cash/paymentMethodCatalog.ts`
- `src/workflows/order-creation/index.ts`
- `src/workspaces/people-access/application/peopleAccessCommands.ts`
- `src/workspaces/studio/presentation/views/InformationFieldsView.tsx`

## Dead-code candidates

- None detected.

## Required verification

```bash
npm run repo:check
npm run quality:gate -- --gate quality.route-module-loads
npm run build
```

Critical journey gate IDs are enumerated in the JSON manifest and validated against the quality manifest authority by the inventory checker.
