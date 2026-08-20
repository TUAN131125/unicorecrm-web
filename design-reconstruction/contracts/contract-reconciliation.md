# Contract reconciliation

Status: NON_AUTHORITATIVE REVIEW.

## Coverage

- OpenAPI: 270/270 operations registered.
- Ready: 236/236 represented in the canonical operation catalog.
- Blocked: 34/34 retained without success contracts.
- Commands: 173/173 classified.
- Queries: 162/162 enumerated and classified (COMPOSED_READ_MODEL 66, FRONTEND_LOCAL 27, PRODUCTION_API 63, DEMO_ONLY 5, BFF_CANDIDATE 1).
- Workflow registry: 27/27 reconciled to source and exact OpenAPI operationIds.
- Non-business contract owners: 6/6 documented, covering 65/65 operations.

## Results

Ready OpenAPI operations are adopted as exact transport candidates and traced to owner, use case, authorization, scope and delivery metadata. Blocked operations remain BLOCKED_BY_DECISION. The two stale derived owners were confirmed against OpenAPI: `replaceWorkspaceCurrencies` and `putWorkspaceExchangeRate` are canonically owned by `platform/workspace-config`, not `workspaces/studio`. The governed derivative under docs/api was not edited.

17 source command entries remain BLOCKED because request/result, capability/scope, idempotency/concurrency, audit/event or transaction semantics are unresolved. Commercial Evidence list/detail production query authority remains UNRESOLVED. Composed/local/demo queries were not manufactured into endpoints.

## Money schema reconciliation

Direct parsing of adopted `docs/api/openapi.json` (SHA-256 `8278547df0fd4be9a9af9b8a6d5f3e15ddad8d005d804c99a7c9248e0f402757`) confirms:

| Schema evidence | Contract value | Canonical disposition |
|---|---|---|
| `#/components/schemas/Money/x-rounding-mode` | `HALF_UP` | MATCH - surfaced in contract conventions, money semantics and DEC-002 without changing the value. |
| `#/components/schemas/Money/x-currency-owner` | `WORKSPACE_CONFIGURATION` | MATCH - workspace configuration remains the currency owner. |
| `#/components/schemas/Money/x-negative-policy` | `OPERATION_SPECIFIC` | MATCH - no schema-wide negative-value behavior is invented. |
| `#/components/schemas/DecimalAmount/x-maximum-scale` | `6` | MATCH - documented as maximum decimal scale, not currency minor units. |
| `#/components/schemas/ProductDocument/x-money-semantics` | `unitPrice and costPrice are authoritative decimal-string Money. Numeric frontend fields are display-only projections.` | MATCH - numeric frontend money fields are documented as display-only and non-authoritative. |

A whole-contract case-insensitive search found no minor-unit declaration. Per-currency minor units therefore remain `NON_BLOCKING_DESIGN_DEBT`; scale 6 is not used as a substitute. R2-01 is resolved as a documentation gap only. No OpenAPI value or Money schema was changed.

## Workflow reconciliation

| Registry | Workflow | Registry readiness | Exact operationId mapping | Disposition |
|---|---|---|---|---|
| WF-01 | contact-opportunity-creation | BLOCKED | None | BLOCKED_BY_DECISION |
| WF-02 | contact-organization-relationship | BLOCKED | None | BLOCKED_BY_DECISION |
| WF-03 | customer-care | BLOCKED | None | BLOCKED_BY_DECISION |
| WF-04 | customer-commercial-actions | BLOCKED | None | BLOCKED_BY_DECISION |
| WF-05 | customer-conversion | BLOCKED | None | BLOCKED_BY_DECISION |
| WF-06 | customer-identity | BLOCKED | None | BLOCKED_BY_DECISION |
| WF-07 | customer-onboarding | BLOCKED | onboardExistingCustomer, completeCustomerOnboarding | BLOCKED_BY_DECISION |
| WF-08 | customer-relationship-integrity | BLOCKED | None | BLOCKED_BY_DECISION |
| WF-09 | deal-recycle | BLOCKED | markDealLostAndPlanRecycle | BLOCKED_BY_DECISION |
| WF-10 | lead-qualification | PRODUCTION_CONTRACT_READY | qualifyLeadForNurture, qualifyLeadForOpportunity, qualifyLeadForDirectSale | MATCH |
| WF-11 | order-cancellation | PRODUCTION_CONTRACT_READY | cancelOrder | MATCH |
| WF-12 | order-closing | BLOCKED | completeOrderFromFulfillmentEvidence | CONFLICT - OpenAPI ready transport adopted; registry readiness stale |
| WF-13 | order-confirmation | READY_WITH_BLOCKED_VARIANT | confirmOrderWithPaymentPlan | MATCH |
| WF-14 | order-creation | BLOCKED | None | BLOCKED_BY_DECISION |
| WF-15 | order-shipping-booking | PRODUCTION_CONTRACT_READY | createOrderOutboundShippingBooking | MATCH |
| WF-16 | quote-acceptance | PRODUCTION_CONTRACT_READY | acceptQuoteAndCloseDeal | MATCH |
| WF-17 | return-credit-refund | PRODUCTION_CONTRACT_READY | resolveReturnCreditRefund, getReturnCreditRefundResolution | MATCH |
| WF-18 | return-resolution | PRODUCTION_CONTRACT_READY | beginReturnCarrierPickup, beginReturnReplacementResolution, completeReturnRepairResolution, completeReturnReplacementFromDelivery, completeReturnResolutionCommand | MATCH |
| WF-19 | return-resolution-evidence | PRODUCTION_CONTRACT_READY | None | MATCH - backend event/internal boundary; no endpoint |
| WF-20 | shipping-cod-evidence | PRODUCTION_CONTRACT_READY | syncShippingBookingCommand, recordCodCustomerCollection, recordCodMerchantRemittance | MATCH |
| WF-21 | work-activation | BLOCKED | None | BLOCKED_BY_DECISION |
| WF-22 | accepted-quote-order-conversion | PRODUCTION_CONTRACT_READY | convertAcceptedQuoteToOrderDraft | MATCH |
| WF-23 | refund-provider-recovery | PRODUCTION_CONTRACT_READY | retryRefundIntent, requestRefundCancellation, listRefundProviderAttempts | MATCH |
| WF-24 | lead-identity-resolution | PRODUCTION_CONTRACT_READY | mergeLeadDuplicates, confirmLeadDuplicatesDistinct | MATCH |
| WF-25 | lead-handover | PRODUCTION_CONTRACT_READY | handoverLeadWithTasks | MATCH |
| WF-26 | lead-follow-up | PRODUCTION_CONTRACT_READY | scheduleLeadFollowUpBatch | MATCH |
| WF-27 | lead-queue-claim | PRODUCTION_CONTRACT_READY | claimLeadFromQueue | MATCH |

The order-closing registry conflict is preserved explicitly: `completeOrderFromFulfillmentEvidence` is PRODUCTION_CONTRACT_READY in OpenAPI, which controls HTTP transport, while the registry row still says BLOCKED. Order confirmation and return-credit-refund now map to their ready transaction/saga operations and are not described as frontend-local.

## Categories

- MATCH: 236 ready operations at machine-contract level.
- BLOCKED_BY_DECISION: 34 OpenAPI placeholders in 26 decision groups.
- CONTRACT_GAP: 17 semantic command entries plus Commercial Evidence authoritative query coverage.
- CONFLICT: one workflow-readiness metadata row (order-closing) is stale relative to adopted OpenAPI.
- RESOLVED_DOCUMENTATION_GAP: 27 workflow mappings, 162 query rows and six non-business owner documents are now explicit.
- RESOLVED_DOCUMENTATION_GAP: R2-01 schema-level money extensions are surfaced; per-currency minor units remain undeclared non-blocking design debt.
