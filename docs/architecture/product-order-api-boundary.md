# Product and Order API Boundary — Phase 16

Status: `READY_FOR_BACKEND_CONNECTION` at frontend contract, adapter and connected-runtime level for the ready Product and Order operations. Live backend acceptance remains external.

## Product authority

`ProductHttpApiAdapter` owns production Product list, detail, availability, price projection, create, replace, archive, restore and batch lifecycle operations. Presentation and application code use `ProductApiRuntime`; generated clients remain inside infrastructure. Connected mode does not use the browser Product repository or generic mutation routing as production authority.

Product price projections transport Money as decimal strings. Backend configuration owns currency, precision, rounding and authoritative prices. Availability is a backend projection and is not inferred from browser inventory. Import, export and demo-data reset remain fail closed in connected mode until typed backend job contracts exist.

## Order authority

`OrderHttpApiAdapter` owns production Order list, detail, draft creation/replacement, repricing, delivery evidence, archive, duplication and downstream eligibility projections. Existing confirm and cancel workflows retain their typed workflow owners. Completion uses a typed operation that asks the backend to evaluate fulfillment and payment evidence; the frontend does not manufacture completion evidence.

Direct Order draft creation preserves the authoritative Payment Plan returned by the backend. Order pricing, totals, tax, discount and rounding remain backend-owned and use decimal-string Money. Existing aggregate mutations use `If-Match`; commands use idempotency keys. Generic lifecycle status patches remain blocked.

## Authoritative operations

Products: `listProducts`, `getProduct`, `getProductAvailability`, `getProductPriceProjection`, `createProduct`, `replaceProduct`, `archiveProduct`, `restoreProduct`, `archiveProductsBatch`, `restoreProductsBatch`.

Orders: `listOrders`, `getOrder`, `getOrderFulfillmentEligibility`, `getOrderInvoiceEligibility`, `getOrderPaymentProjection`, `createOrderDraftCommand`, `updateOrderDraftCommand`, `repriceOrderDraft`, `recordOrderSendEvidenceCommand`, `archiveOrderCommand`, `archiveOrdersBatch`, `duplicateOrderDraft`, `completeOrderFromFulfillmentEvidence`.

## Runtime path

```text
Product / Order presentation
  -> module public application boundary
  -> ProductApiRuntime / OrderApiRuntime
  -> ProductHttpApiAdapter / OrderHttpApiAdapter
  -> generated API client
  -> platform transport
  -> backend
```

## Production acceptance still required

A durable backend must implement the ready operations, enforce workspace and authorization scopes, persist idempotency and resource versions, preserve financial precision, evaluate downstream eligibility, pass the live provider pack and pass browser E2E against a real database.
