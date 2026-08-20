# Order-to-Cash Operations

This document describes the current frontend contracts for Order, Payment Plan, Payment Request, Payment Record, Payment Allocation, Invoice, Receivable, Shipping and Return operations.

## Business evidence boundaries

- A Payment Request asks the buyer to pay; it is not evidence that money was received.
- A Payment Record represents received money. It lowers a specific Invoice balance only after an effective Payment Allocation exists.
- Transfer screenshots and other attachments remain evidence requiring verification; they do not mutate receivables by themselves.
- Successful COD delivery is shipping evidence. COD affects cash and receivables only after merchant remittance is recorded by the Payment owner.
- Receivable balances are projected from issued Invoice value minus effective allocations and issued Credit Notes. No command edits the balance directly.
- Orders, Invoices, Payment Records, Allocations and receivable evidence are durable. Lifecycle transitions replace hard deletion.

## Configuration authority target

Payment methods, receiving accounts, seller information, reason catalogs, aging policies and provider connections require versioned backend-owned workspace configuration. The current frontend may retain development defaults for operational demos, but those defaults are not Studio authority and must not be presented as durable workspace settings.

The replacement Studio will expose only the approved workspace settings defined in `docs/product/studio-rebuild-roadmap.md`. Operational Payment, Invoice, Receivables, Shipping and Return state remains owned by the respective modules and backend commands.

## Invoice contract

The Invoice Editor preserves all existing lines and supports partial and repeated invoicing from one Order. Each line carries source Order line identity, ordered quantity, previously invoiced quantity, remaining invoiceable quantity, current quantity, price, discount, tax, totals and notes. Over-invoicing is blocked before save and issue. Each draft creation uses a unique creation intent and idempotency key. Issued commercial content is immutable; correction uses void or line-level Credit Note policy.

## Payment contract

Payment Operations and Payment Detail use Payment Record as the canonical model. The detail contract includes evidence, allocations, customer credit, refunds, reconciliation, refundable amount, unallocated amount, audit and related navigation. Allocation reversal requires a configured reason code, mandatory note, actor and version. Payment Request communication supports preview, content/link copy, QR, email handoff, downloadable instructions, send history, failed delivery and retry without changing the Payment Request business state on communication failure.

## Receivable operations

Receivable Detail supports manual payment navigation, Payment Request creation, allocation, audited reversal, reminders, collection notes, promise-to-pay, owner assignment, dispute, credit hold, escalation and write-off proposal. These actions are an operational ledger and never mutate the authoritative balance. Account Statement presents opening balance, issued invoices, allocations, reversals, Credit Notes, payment/refund/customer-credit information and closing balance separately by currency with date filtering, preview/print and CSV export.

## Shipping and Return contract

Shipping runtime currently uses development provider configuration; production provider catalogs must come from the backend integration authority. New booking is limited to active providers, enabled services and supported capabilities. Paused providers remain readable for historical bookings. Default provider, service filtering, COD support, label, tracking, sync and cancel actions follow provider capability data. Return creation can start from a delivered Order or Shipping booking and is prefilled with canonical delivery evidence and only the remaining returnable line quantity.

## Async and integration readiness

Shared mutation state distinguishes idle, submitting, succeeded, validation failure, business blocker, version conflict, network failure and cancellation. Commands retain idempotency, expected version, correlation, retryability and authoritative response fields so browser repositories can be replaced by API adapters without redesigning screens. The current repository still uses development/browser adapters; this document does not claim live bank, carrier, invoice-provider, SMS or Zalo integrations.

## Verification

```bash
npm run quality:gate -- --gate quality.order-operations-frontend-contracts
npm run quality:gate -- --gate quality.invoice-domain-contracts
npm run quality:gate -- --gate quality.payment-method-catalog-contracts
npm run quality:gate -- --gate quality.payment-plan-contracts
npm run quality:gate -- --gate quality.payment-intent-contracts
npm run quality:gate -- --gate quality.payment-allocation-contracts
npm run quality:gate -- --gate quality.receivables-contracts
npm run quality:gate -- --gate quality.shipping-returns-contracts
npm run quality:gate -- --gate quality.return-credit-refund-contracts
npm run quality:gate -- --gate quality.route-module-loads
npm run build
```
