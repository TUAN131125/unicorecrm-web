# P0.1 domain decision closure

Contract version: `0.14.0-contract.0`  
Input candidate SHA-256: `3a552c51585a3d030e3cae3d5df3253b39fd08da13f6c9ec1352a80b286d3e95`

> Historical decision snapshot. The blocker states below describe P0.1 only and are superseded by later CLOSED decision packs. Current implementation authority is the operation-level OpenAPI contract plus `unresolved-decisions.json`.

## Closed decisions

| Decision | Result | Evidence | Backend contract effect |
| --- | --- | --- | --- |
| DEC-INVOICE-DRAFT-CREATE | CLOSED | `InvoiceApiPort.CreateInvoiceDraftInput`, Invoice create form, invoice draft validation | `createInvoiceDraft` accepts editable Order-backed intent only. Backend assigns IDs, calculates all amounts and returns an authoritative mutation outcome. |
| DEC-INVOICE-DRAFT-SAVE | CLOSED | `InvoiceApiPort.SaveInvoiceDraftInput`, demo adapter save behavior, edit form | `saveInvoiceDraft` accepts DRAFT-editable fields only and requires `If-Match` plus `Idempotency-Key`. |
| DEC-INVOICE-ISSUE | CLOSED | `invoiceCommands.issueInvoice`, `validateInvoiceDraft`, issue-readiness query | `issueInvoice` is a typed, versioned, idempotent lifecycle command. |

## Blockers recorded at P0.1

| Decision | Status | Why it remains blocked | Owner |
| --- | --- | --- | --- |
| DEC-QUOTE-ACCEPTANCE-SEMANTICS-CONFLICT | BLOCKED | Frontend workflow returns Quote plus optional Deal; the former API response additionally required Order creation and targeted different concurrency evidence. | Quote, Deal and Order domain owners |
| DEC-ORDER-CONFIRMATION-TRANSACTION | BLOCKED | Demo code coordinates Order, Payment Plan, credit approval and Deal close with snapshot rollback; atomicity is not approved. | Order, Payments and Sales domain owners |
| DEC-ORDER-CANCELLATION-COMPENSATION | BLOCKED | Invoice, payment and shipping blockers/compensations do not have an approved backend state model. | Order, Finance and Fulfillment domain owners |
| DEC-PAYMENT-FINANCIAL-EFFECTS | BLOCKED | Allocation, reconciliation, refund and COD evidence require approved financial state machines and replay rules. | Payments/Finance domain owner |

Machine-readable authority: `p01-domain-decision-closure.json`.
