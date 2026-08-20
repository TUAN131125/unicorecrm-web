# Decision ledger

Contract version: `0.23.20-contract.0`. OpenAPI operation status is authoritative.

A `BLOCKED` operation can be an intentionally retired generic surface whose replacement decision is already closed. It remains here so generated clients continue to fail closed.

## Current unresolved or externally blocked decisions

| Decision | Status | Question | Owner | Affected scope |
| --- | --- | --- | --- | --- |
| DEC-COMMAND-SEMANTICS | BLOCKED | Approve explicit request/result/invariants for blocked frontend commands. | Module Domain Owner + API Contract Architect | contact-organization.end-relationship, contact-organization.set-primary-representative, contact-organization.upsert-relationship, contact.anonymize … |
| DEC-PLATFORM-CONNECTED-PROJECTIONS | PARTIALLY_CLOSED | Define OpenAPI operations for effective access, audit trail and external authority health. | Identity/Platform Backend Owner | auditTrail.list, externalAuthorityHealth.evaluate |
| DEC-MONEY-DOMAIN-POLICY | PARTIALLY_CLOSED_BY_TRANSPORT_CONTRACT | Approve precision, document tax semantics and allocation residual rules. | Finance Domain Owner | allocateCustomerCredit, allocatePayment, resolveReturnCreditRefund customer-credit variant |
| DEC-ORDER-CONFIRMATION-TRANSACTION | CLOSED_BY_P02_P06_WITH_BLOCKED_INLINE_VARIANT | Which aggregate owns Order confirmation, Payment Plan activation, credit approval evidence and Deal close, and which effects are atomic? | Order Domain Owner + Payments Domain Owner + Sales Domain Owner | approveOrderCreditOverride, order.confirm |
| DEC-PAYMENT-FINANCIAL-EFFECTS | PARTIALLY_CLOSED_BY_P04_P05_P06_P08 | Approve authoritative allocation, reconciliation, refund and COD state machines, residual policy, provider evidence and replay behavior. | Payments/Finance Domain Owner + API Contract Architect | resolveReturnCreditRefund customer-credit variant |
| DEC-P02-ORDER-CONFIRMATION-NO-INLINE-CREDIT-OVERRIDE | CLOSED_WITH_BLOCKED_VARIANT | Can the frontend provide credit approval evidence inline with Order confirmation? | Order/Finance domain owners | approveOrderCreditOverride |
| DEC-P09-LIVE-PROVIDER-CONFORMANCE | BLOCKED_EXTERNAL | Execute all 516 provider scenarios against a provisioned backend with authenticated actors and two isolated workspaces. | Backend Platform + Security + Module Owners | — |

## Closed or superseded decision records

| Decision | Status | Question | Owner | Affected scope |
| --- | --- | --- | --- | --- |
| DEC-SHIPPING-PROVIDER-CONTRACT | CLOSED_BY_PHASE18 | Define provider quote/booking/cancel/get/sync DTOs with Money, idempotency and external evidence. | Fulfillment Backend Owner | — |
| DEC-LEAD-ARCHIVE-ANONYMIZE | CLOSED_BY_PHASE6 | Define archive/anonymize retention, reopen and conversion interaction. | Lead Domain Owner + Privacy Owner | — |
| DEC-QUOTE-ACCEPTANCE-SEMANTICS-CONFLICT | CLOSED_BY_P02_P15_WITH_RETIRED_GENERIC_OPERATION | Does quote acceptance only accept the Quote and optionally close its Deal, or must it atomically create an Order as the former OpenAPI response implied? | Quote Domain Owner + Order Domain Owner + API Contract Architect | acceptQuote |
| DEC-ORDER-CANCELLATION-COMPENSATION | CLOSED | Define cancellation blockers and compensation ownership for issued invoices, effective allocations, active payment plans and shipping bookings. | Order Domain Owner + Finance Domain Owner + Fulfillment Domain Owner | — |
| DEC-P02-QUOTE-ACCEPTANCE-SEPARATE-ORDER-CREATION | CLOSED | Does Quote acceptance create an Order? | Quote/Deal domain owners | — |
| DEC-P02-ORDER-CANCELLATION-NO-COMPENSATION | CLOSED | Does Order cancellation compensate invoices, payments and shipping? | Order domain owner | — |
| DEC-P02-PAYMENT-RECONCILIATION | CLOSED | What is the Payment Record reconciliation command? | Payments domain owner | — |
| DEC-P02-PAYMENT-ALLOCATION | SUPERSEDED_BY_P04 | Who assigns allocation IDs, validates invoice balance and owns multi-invoice residual handling? | Payments and Receivables domain owners | — |
| DEC-P02-REFUND-ASYNC-LIFECYCLE | CLOSED_BY_P05_P06_P08 | Does refund creation mean intent accepted or funds succeeded, and which event releases Return resolution? | Payments and Returns domain owners | — |
| DEC-P02-COD-SETTLEMENT | CLOSED_BY_P04 | What evidence and ledger events prove COD collection and merchant remittance? | Payments, Shipping and Finance domain owners | — |
| DEC-P03-COMMERCIAL-READ-MODELS | CLOSED | Provide authoritative Deal/Quote/Order list/detail projections and concurrency versions. | API Contract Architect | — |
| DEC-P03-ORDER-CREDIT-APPROVAL-LIFECYCLE | CLOSED_BY_P06 | What aggregate, lifecycle and evidence authorize an Order confirmation that exceeds server-evaluated credit policy? | Credit Policy Domain Owner + Security/Authorization Architect + API Contract Architect | — |
| DEC-P03-ACCEPTED-QUOTE-ORDER-COMMAND-SPLIT | CLOSED_BY_P06_P07 | The existing frontend order.create command combines direct-sale draft creation and accepted-Quote conversion, which have different preconditions and idempotency identities. | Order Domain Owner + Quote Domain Owner + API Contract Architect | — |
| DEC-P04-RETURN-REFUND-SAGA | CLOSED_BY_P05 | Return credit/refund saga ownership and failure persistence. | returns+payments+invoices | — |
| DEC-P04-REFUND-CANCEL-RETRY | CLOSED_BY_P08 | When may a failed/processing refund be cancelled or retried and how is provider idempotency retained? | payments+provider-integration | — |
| DEC-P05-RETURN-CUSTOMER-CREDIT-REFUND-POLICY | CLOSED_BY_P06 | May Return resolution reverse or consume Customer Credit allocations, and what evidence is produced? | finance-domain-owner | — |

## Current blocked OpenAPI operations

| Decision | Status | Question | Owner | Operations |
| --- | --- | --- | --- | --- |
| DEC-ALLOCATECUSTOMERCREDIT | BLOCKED | Approve, redesign or retire OpenAPI operation allocateCustomerCredit. | payments | allocateCustomerCredit |
| DEC-ALLOCATEPAYMENT | BLOCKED | Approve, redesign or retire OpenAPI operation allocatePayment. | payments | allocatePayment |
| DEC-CREATECRMOBJECTFIELD | BLOCKED | Approve, redesign or retire OpenAPI operation createCrmObjectField. | platform/workspace-config | createCrmObjectField |
| DEC-CREATECRMPIPELINE | BLOCKED | Approve, redesign or retire OpenAPI operation createCrmPipeline. | platform/workspace-config | createCrmPipeline |
| DEC-CREATECRMPIPELINESTAGE | BLOCKED | Approve, redesign or retire OpenAPI operation createCrmPipelineStage. | platform/workspace-config | createCrmPipelineStage |
| DEC-CREATEINTEGRATIONCONNECTION | BLOCKED | Approve, redesign or retire OpenAPI operation createIntegrationConnection. | platform/integrations | createIntegrationConnection |
| DEC-CREATEPRODUCTCONFIGURATIONTYPE | BLOCKED | Approve, redesign or retire OpenAPI operation createProductConfigurationType. | products | createProductConfigurationType |
| DEC-DELETECRMOBJECTFIELD | BLOCKED | Approve, redesign or retire OpenAPI operation deleteCrmObjectField. | platform/workspace-config | deleteCrmObjectField |
| DEC-DELETECRMPIPELINE | BLOCKED | Approve, redesign or retire OpenAPI operation deleteCrmPipeline. | platform/workspace-config | deleteCrmPipeline |
| DEC-DELETECRMPIPELINESTAGE | BLOCKED | Approve, redesign or retire OpenAPI operation deleteCrmPipelineStage. | platform/workspace-config | deleteCrmPipelineStage |
| DEC-DELETEPRODUCTCONFIGURATIONTYPE | BLOCKED | Approve, redesign or retire OpenAPI operation deleteProductConfigurationType. | products | deleteProductConfigurationType |
| DEC-DISCONNECTINTEGRATIONCONNECTION | BLOCKED | Approve, redesign or retire OpenAPI operation disconnectIntegrationConnection. | platform/integrations | disconnectIntegrationConnection |
| DEC-MARKDEALLOSTANDPLANRECYCLE | BLOCKED | Approve, redesign or retire OpenAPI operation markDealLostAndPlanRecycle. | deals | markDealLostAndPlanRecycle |
| DEC-MUTATION-RESULT-PROJECTION | BLOCKED | Approve, redesign or retire OpenAPI operation createContact. | contacts | completeCustomerOnboarding, createContact, createOrganization, linkContactToOrganization … |
| DEC-P15-TYPED-QUOTE-LIFECYCLE | BLOCKED | Retain ambiguous generic Quote lifecycle operations as blocked and use typed Quote commands. | quotes | acceptQuote, changeQuoteStatusCommand |
| DEC-PHASE5-GENERIC-LEAD-QUALIFICATION-RETIRED | BLOCKED | Retain generic Lead qualification as blocked and use the three typed qualification workflows. | leads + owning downstream workflow modules | qualifyLead |
| DEC-PUTWORKSPACEEXCHANGERATE | BLOCKED | Approve, redesign or retire OpenAPI operation putWorkspaceExchangeRate. | platform/workspace-config | putWorkspaceExchangeRate |
| DEC-REPLACEINVOICESELLERINFORMATIONCONFIGURATION | BLOCKED | Approve, redesign or retire OpenAPI operation replaceInvoiceSellerInformationConfiguration. | platform/workspace-config | replaceInvoiceSellerInformationConfiguration |
| DEC-REPLACEPAYMENTRECEIVINGACCOUNTS | BLOCKED | Approve, redesign or retire OpenAPI operation replacePaymentReceivingAccounts. | platform/workspace-config | replacePaymentReceivingAccounts |
| DEC-REPLACEWORKSPACECURRENCIES | BLOCKED | Approve, redesign or retire OpenAPI operation replaceWorkspaceCurrencies. | platform/workspace-config | replaceWorkspaceCurrencies |
| DEC-UPDATECRMOBJECTFIELD | BLOCKED | Approve, redesign or retire OpenAPI operation updateCrmObjectField. | platform/workspace-config | updateCrmObjectField |
| DEC-UPDATECRMPIPELINE | BLOCKED | Approve, redesign or retire OpenAPI operation updateCrmPipeline. | platform/workspace-config | updateCrmPipeline |
| DEC-UPDATECRMPIPELINESTAGE | BLOCKED | Approve, redesign or retire OpenAPI operation updateCrmPipelineStage. | platform/workspace-config | updateCrmPipelineStage |
| DEC-UPDATEINTEGRATIONCONNECTION | BLOCKED | Approve, redesign or retire OpenAPI operation updateIntegrationConnection. | platform/integrations | updateIntegrationConnection |
| DEC-UPDATEPRODUCTCONFIGURATIONTYPE | BLOCKED | Approve, redesign or retire OpenAPI operation updateProductConfigurationType. | products | updateProductConfigurationType |
| DEC-VERIFYINTEGRATIONCONNECTION | BLOCKED | Approve, redesign or retire OpenAPI operation verifyIntegrationConnection. | platform/integrations | verifyIntegrationConnection |
