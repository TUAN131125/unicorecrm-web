# Stage 6 compatibility retirement

> **Status:** CURRENT  
> **Verified against:** `unicorecrm-web@0.14.0-contract.0`  
> **Scope:** Frontend compatibility and deprecated-surface cleanup

Stage 6 reduced the active compatibility inventory from **77 → 53** and the deprecated surface inventory from **13 → 9**, with zero dependency cycles and no removal of required route, migration or persisted-data support.

## Completed retirements

- Removed 17 route-module export aliases; lazy route selectors now consume canonical page exports directly.
- Removed public alias exports from Invoice collection activities and Shipping configuration operations.
- Removed two workflow export aliases while preserving canonical workflow functions and mutation command boundaries.
- Replaced the ambiguous payment-method `deprecated` flag with `availability: "ACTIVE" | "HISTORICAL_ONLY"`.
- Added Studio snapshot schema version 3 normalization so old `deprecated: true` values become disabled historical-only methods at the persistence boundary.
- Renamed migration APIs and fixtures by current responsibility without deleting supported migration behavior.

## Retired candidate paths

The following paths no longer appear as compatibility candidates because their alias/deprecated surface was removed or renamed:

- Former legacy-named customer relationship migration fixture (renamed to the responsibility-based records path)
- `src/modules/invoices/account-statement-route.tsx`
- `src/modules/invoices/detail-route.tsx`
- `src/modules/invoices/form-route.tsx`
- `src/modules/invoices/list-route.tsx`
- `src/modules/invoices/public/index.ts`
- `src/modules/invoices/receivable-detail-route.tsx`
- `src/modules/invoices/receivables-route.tsx`
- `src/modules/organizations/detail-route.tsx`
- `src/modules/organizations/list-route.tsx`
- `src/modules/payments/application/queries/effectivePaymentMethodCatalog.ts`
- `src/modules/payments/detail-route.tsx`
- `src/modules/payments/domain/model/paymentCollection.types.ts`
- `src/modules/payments/list-route.tsx`
- `src/modules/returns/detail-route.tsx`
- `src/modules/returns/form-route.tsx`
- `src/modules/returns/list-route.tsx`
- `src/modules/shipping/detail-route.tsx`
- `src/modules/shipping/list-route.tsx`
- `src/modules/shipping/public/index.ts`
- `src/modules/tasks/detail-route.tsx`
- `src/modules/tasks/list-route.tsx`
- `src/workflows/deal-recycle/index.ts`
- `src/workflows/order-closing/index.ts`
- `src/workspaces/studio/control-plane/domain/studioControlPlane.types.ts`
- `src/workspaces/studio/presentation/pages/PaymentPolicyPage.tsx`

## Subsequent Studio cleanup

The Studio replacement preparation removed the former Studio control-plane, its browser snapshot adapter, runtime projection and rollback compatibility surfaces. The active candidate ledger was regenerated from the current source rather than retaining entries for deleted files.

## Intentionally retained

After the later full Studio cleanup and inventory reconciliation, 51 candidates remain. They include active route redirects, UI translation compatibility, migration tooling, persisted-data adapters and domain fields still consumed by existing frontend workflows. These are not dead code and remain governed by `compatibility-ledger.json`.

## Verification

- `npm run quality:gate -- --gate quality.compatibility-retirement`
- `npm run quality:gate -- --gate quality.contract-baseline`
- `npm run repo:check`
- `npm run quality:gate -- --gate quality.repository-cleanup`
- Full deterministic quality pipeline and production build
