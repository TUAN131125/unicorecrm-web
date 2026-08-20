# Unicore CRM Frontend Build Skill

## Mission

Build production-grade frontend for Unicore CRM without inventing business truth, fake workflows, arbitrary UI, hardcoded financial policy or backend behavior that does not exist.

Current business area:

```text
Quote
→ Order
→ Payment Agreement
→ Payment Plan / Schedule
→ Invoice
→ Receivables
→ Payment Intent / Transaction / Allocation
→ Shipping / COD
→ Return / Credit Note / Refund
```

The repository is frontend-only. Implement contracts, UI states, ports, adapters, DTO mappings, fixtures and backend-ready boundaries. Never present browser memory, localStorage, redirect parameters, toast messages or frontend calculations as durable financial truth.

## Mandatory reading

Before editing, read:

```text
AGENTS.md
README.md
ARCHITECTURE.md
docs/product/guidance-system.md
docs/quality/form-and-presentation-contracts.md
docs/quality/verification.md
docs/architecture/module-ownership-and-workflows.md
docs/business/order-to-cash-frontend-build-spec.md
docs/business/payment-plans-and-collections-frontend-spec.md
```

Any route, action, field, validation, state, copy, permission or guidance change must update the related contracts in the same change.

## Architecture

Dependency direction:

```text
src/app
→ src/workspaces
→ src/workflows
→ src/modules
→ src/shared + src/platform
```

Rules:

- Import another module only through its public API.
- Do not deep-import another module's internal domain/application/infrastructure/presentation files.
- Business rules belong to the owning domain/application layer.
- Cross-owner orchestration belongs in `src/workflows/`.
- Cross-module read composition belongs in workspace read models.
- Presentation calls queries, commands, workflows or public facades.
- Infrastructure implements ports; it does not invent business truth.
- A read model never gains write ownership.

## Business ownership

### Orders

Own:

- Order lifecycle;
- buyer reference;
- commercial line snapshots;
- recipient/shipping prerequisites;
- accepted Payment Agreement snapshot.

Do not own:

- payment success;
- payment intent;
- invoice issuance;
- outstanding balance;
- carrier execution;
- refund success;
- reconciliation.

Canonical Order states:

```text
DRAFT → CONFIRMED → COMPLETED
DRAFT → CANCELLED
CONFIRMED → CANCELLED
```

Do not add `FAILED` to Order.

Quote acceptance never creates an Order. Use the dedicated accepted-Quote conversion command for one Order draft per accepted Quote, or the direct Order draft command for a sale without Quote conversion. Do not merge these idempotency and precondition boundaries.

### Payments

Own:

- Payment Plan;
- Payment Schedule Line;
- Payment Method Catalog consumption contract;
- Payment Intent;
- Payment/Refund Transaction;
- Allocation;
- Customer Credit/Unapplied Amount;
- reconciliation;
- COD collection/remittance evidence.

### Invoices

Own:

- Invoice Draft and issue lifecycle;
- legal snapshots;
- invoice lines/totals;
- delivery state;
- Credit Notes;
- source links.

Issued Invoice content is immutable in the UI.

### Receivables

Receivables is an invoice-level read model:

```text
Issued Invoice
- effective Payment Allocations
- issued Credit Notes
= Outstanding Amount
```

Never implement direct balance editing.

### Shipping

Own carrier booking and delivery evidence. Shipping does not manufacture payment success.

### Returns

Own Return lifecycle. Return completion requires evidence from Invoice, Payment or Shipping owners.

## Never conflate payment dimensions

These are independent dimensions:

```text
Payment Plan Kind  = how the amount is split
Payment Purpose    = deposit, balance, installment, full, milestone
Payment Due Rule   = when it becomes due
Payment Method     = bank transfer, cash, card, wallet, COD, etc.
Payment Channel    = bank, online gateway, POS, carrier, offline
Fulfillment Gate   = what operation is blocked until paid
Invoice Policy     = when billing documents are created
```

Forbidden:

- one field named “Payment type” representing all dimensions;
- deriving due timing from method;
- deriving method from timing;
- assuming `ON_DELIVERY` means COD;
- assuming `POSTPAID` means bank transfer;
- assuming online payment is one method;
- assuming one Payment Schedule Line equals one Invoice.

## Required payment patterns

Contracts and UI must support:

- full prepayment;
- deposit and balance;
- payment before booking/dispatch;
- payment on delivery;
- COD;
- payment after delivery/acceptance;
- Net terms after invoice;
- online payment intents;
- partial payment;
- finite installments;
- milestone payments;
- mixed methods;
- overpayment as customer credit;
- allocation across multiple invoices.

Open-ended recurring subscription is not an Order installment. Do not invent subscription UI without an approved Contract/Subscription owner.

## No invented UI

Every screen, card, tab, metric, action, field, badge and chart must map to:

1. a named user goal;
2. an owned business concept;
3. a query/command contract;
4. an acceptance criterion.

Do not add:

- decorative dashboards;
- guessed KPIs;
- fake timelines;
- random summary cards;
- provider controls without a provider contract;
- “smart suggestions” without an approved query;
- payment method options hardcoded in a page.

When a backend capability is unavailable:

- disable the action with a precise reason; or
- connect it to an approved development adapter implementing the same port;
- never show business success from local state only.

## No fake success

A success message is allowed only after:

- a real command resolves;
- response DTO is validated/mapped;
- the returned record or refreshed snapshot is authoritative.

Forbidden examples:

```ts
onClick={() => setToast("Invoice created")}
```

```ts
if (searchParams.get("success") === "true") {
  markPaymentSucceededLocally();
}
```

Opening a modal, generating a preview, copying a payment link, opening a checkout URL or returning from provider is not a completed financial action.

## Online payment rules

- Use Payment Intent/Checkout Session contracts.
- Do not store provider secrets, card data or authorization headers.
- Do not trust redirect query parameters as payment truth.
- Query backend after callback.
- Display `PROCESSING` until authoritative terminal state.
- Poll with shared query policy and AbortSignal.
- Stop polling on unmount/terminal state.
- Do not create local Payment Transaction after timeout.
- Retry only through an approved command and idempotency contract.
- Never provide a frontend “Mark as paid” action for gateway payments.

## COD rules

Keep separate:

```text
COD requested
customer collection confirmed
carrier remittance pending/remitted/failed
effective for receivables
reconciliation
```

Do not:

- mark paid from COD request;
- mark collected from shipment delivery alone;
- mark remitted from collection;
- decide locally when receivables should be reduced.

Use backend `effectiveForReceivables` or equivalent projection.

## Payment Plan rules

- Payment Plan is versioned.
- DRAFT may be edited.
- ACTIVE with financial evidence may not be edited in place.
- Use supersede/amendment workflow.
- Schedule lines use due-rule discriminated unions.
- Finite recurring schedules are backend preview/generated.
- Do not generate authoritative installments in React effects.
- Do not hardcode Net 7/15/30 presets in pages; use templates/configuration.
- Do not allow open-ended recurrence in an Order plan.
- Do not calculate authoritative percentages/totals in the component.

## Invoice and receivables rules

- Payment Schedule Line is not an Invoice.
- Payment Obligation label is not an invoice number.
- Payment Allocation targets Invoice/Receivable, not Order.
- Optional schedule-line references are commercial trace only.
- Prepayment before Invoice becomes Customer Credit/Unapplied Amount.
- Issued Invoice cannot be edited.
- Correction uses Credit Note or backend-supported replacement.
- Receivables balance is read-only projection.

## No hardcoded business data

Do not hardcode in presentation:

- route paths;
- capability strings;
- status labels/tones/icons;
- payment method lists;
- provider lists;
- payment plan templates;
- installment counts;
- due-rule presets;
- Net terms;
- currency defaults;
- tax rates;
- COD availability/limits;
- invoice policies;
- seller legal data;
- totals;
- demo rows;
- record IDs;
- navigation order;
- success/failure outcomes;
- date locale behavior.

Correct sources:

```text
routes/capabilities → centralized catalogs
method/provider     → API/configuration catalog
plan templates      → API/configuration
status metadata     → centralized metadata registry
copy                → i18n/guidance
money/date          → shared formatters
fixtures            → seed/test folders only
business rules      → domain/application/readiness
```

Moving arbitrary literals to another file without an owner/test is still hardcoding.

## Durable IDs

Do not create durable business IDs in pages/components with:

```ts
Date.now()
Math.random()
crypto.randomUUID()
```

A client-generated idempotency key may use an approved shared utility. Durable record IDs come from backend/adapter command response.

## Money safety

Use:

```ts
interface MoneyDto {
  amount: string;
  currency: string;
}
```

Rules:

- no JavaScript floating-point business truth;
- no page-local sum for readiness/settlement;
- no scattered `toLocaleString` for financial data;
- use shared money formatter/input;
- do not use native `type="number"` as the only money parser;
- render authoritative preview totals;
- do not combine currencies without authoritative conversion;
- refund is not a negative payment;
- pending/failed transaction does not reduce receivables;
- do not independently round tax/discount/installment values in UI.

## API-ready frontend

Presentation must not call `fetch` directly.

```text
presentation
→ application command/query/workflow
→ port
→ InMemory adapter or HTTP adapter
```

Writes support where applicable:

- workspace context;
- actor/capability context;
- AbortSignal;
- correlation ID;
- idempotency key;
- version/ETag;
- Problem Details;
- field errors;
- readiness blockers.

Frontend validation is UX only. Backend remains authoritative.

## Adapter rules

Provide matching:

```text
InMemory<Module>Repository
Http<Module>Repository
```

In-memory adapter:

- enforces documented invariants;
- uses deterministic seed/test fixtures;
- supports success, pending, failure, expiry, conflict and permission scenarios;
- never lives in pages;
- never claims to be production backend;
- does not fake webhook verification.

HTTP adapter:

- maps DTOs/errors at boundary;
- transmits correlation/idempotency/version;
- uses response as authoritative;
- redacts secrets;
- accepts cancellation;
- distinguishes validation, conflict, permission, not-found, provider and network errors;
- does not silently retry writes without idempotency.

## State management

- Server state has one authoritative owner.
- Form state is temporary.
- Do not copy the same record into multiple independent states.
- Do not reset active edits on background refresh.
- Mutations have explicit idle/pending/success/error states.
- Disable repeat submit while pending.
- Use pessimistic confirmation for financial mutations.
- After success use returned record or controlled refetch.
- Show stale/version conflicts with recovery actions.
- Do not persist payment secrets or checkout payloads beyond their contract.

## Action policy

Do not scatter conditions through JSX.

Create selectors such as:

```ts
getOrderActionPolicy(context)
getPaymentPlanActionPolicy(context)
getPaymentIntentActionPolicy(context)
getPaymentTransactionActionPolicy(context)
getInvoiceActionPolicy(context)
```

Policy combines:

- lifecycle state;
- readiness;
- capability;
- provider availability;
- related blockers;
- concurrency/version state.

## Forms

Shared sizing:

```text
1–4 controls  → sm / 520px
5–20 controls → md / 840px
21+ controls  → lg / 1200px
```

Rules:

- Payment Plan Builder and Invoice Draft are full-page forms.
- Allocation/checkout support surfaces use real complexity sizing.
- No local `max-w-*` overrides around shared modals.
- Native form buttons have explicit `type`.
- Controlled controls have `onChange`, `readOnly` or `disabled`.
- Long transaction forms have persistent footer.
- Field errors and command-level blocker summary are both present.
- Backend-owned invoice number/provider reference are not editable.
- Method options come from catalog and preserve disabled reasons.

## Typography

Do not make the interface bold everywhere.

```text
Page title       600–700
Section title    600
Field label      500–600
Body text        400–500
Table body       400–500
Table header     500–600
Button           600
Badge            500–600
Important total  600–700
Metadata/helper  400–500
```

Hard rules for new Order-to-Cash code:

- no `font-black`;
- no `font-extrabold` in operational UI;
- do not bold every table cell or label;
- do not uppercase all table headers;
- body/table text not below 12px;
- operational data normally 13–14px or larger;
- do not combine heavy weight, strong color, uppercase and shadow on one element;
- prefer whitespace/alignment/grouping before visual weight.

## Visual language

- Use existing design primitives and semantic tokens.
- No arbitrary hex or page-local status colors.
- Lifecycle, schedule, intent, transaction, settlement and remittance are separate dimensions.
- Color is not the only signal.
- Avoid excessive shadows, gradients, oversized rounded cards and dashboard-card repetition.
- Financial tables prioritize alignment, currency, tabular numerals and stable widths.

## Lists and details

Every list has:

- initial loading;
- background refresh;
- dataset empty;
- filtered empty;
- recoverable error;
- permission state;
- stale/conflict state.

Do not add summary cards unless query returns authoritative aggregates.

Order Detail may show read-only tabs for plans, invoices, payments, credits, shipping and returns. A tab does not gain write ownership.

## Accessibility

Required:

- keyboard navigation;
- visible focus;
- focus trap/restore for dialogs;
- labels for controls/icon buttons;
- errors associated with fields;
- loading/status announcements;
- no hover-only essential information;
- no color-only states;
- responsive reflow preserving financial context.

## Copy and localization

- Use translation/guidance system.
- Keep Vietnamese/English glossary consistent.
- Do not use Invoice, Payment Schedule, Receivable and Payment as synonyms.
- Do not say created, issued, paid, collected, remitted, refunded, cancelled or completed until the owning command confirms it.
- Error copy identifies action, record, reason and recovery.
- Empty states do not advertise unavailable actions.

## Required UI states

```text
initial loading
background refresh
empty dataset
empty filter result
recoverable error
not found
access denied
stale/version conflict
partial related-data error
mutation pending
validation error
provider unavailable
payment processing
payment intent expired
reconciliation mismatch
```

Never silently replace failure with seed data.

## Security and privacy

Never store/log:

- raw tokens;
- authorization headers;
- provider secrets;
- bank credentials;
- card data;
- digital-signature secrets;
- unredacted sensitive payloads.

Browser permission checks are UX only. Backend enforces authorization.

## Durable record rules

Do not hard delete:

- confirmed/completed/cancelled Orders;
- active/superseded Payment Plans with evidence;
- issued Invoices/Credit Notes;
- Payment/Refund Transactions;
- Allocations;
- Customer Credits;
- Shipping/Return evidence.

Use lifecycle commands: discard draft, cancel, supersede, void, reverse allocation, credit note or refund.

## Specific prohibitions

Do not:

- create Invoice via toast only;
- map Payment Obligation label to invoice number;
- create Order directly CONFIRMED from copy;
- edit confirmed Order in draft form;
- let Shipping failure set Order FAILED;
- mark payment success from redirect/callback query;
- mark paid from COD requested;
- merge COD collected and remitted;
- reduce receivables for PENDING/FAILED payment;
- allocate payment directly to Order in the new contract;
- edit issued Invoice;
- directly edit outstanding balance;
- generate authoritative installment dates/amounts in React;
- hardcode method/provider/template options in a page;
- use local clock as accounting truth;
- combine currencies without authoritative result;
- create open-ended subscription schedule inside Order;
- calculate financial readiness with floating point;
- show fake success when only local state changed.

## Test expectations

Add focused tests/guards for:

- state machines;
- action policies;
- memory/HTTP contract parity;
- DTO mapping and unknown enum fallback;
- money-safe rendering;
- no fake success;
- no obligation-as-invoice;
- no payment hardcode in presentation;
- online callback cannot mark success;
- COD states separated;
- prepay/postpay/installment patterns;
- customer credit;
- allocation limits;
- issued Invoice immutability;
- Order copy creates DRAFT via command;
- loading/empty/error/permission/conflict states;
- keyboard/focus behavior;
- bilingual guidance;
- typography: no `font-black`, no operational `font-extrabold`, no text below 12px.

Run focused tests and repository gates required by `AGENTS.md`. Do not edit tests only to make them pass. Do not claim browser E2E PASS unless browser E2E ran.

## Completion checklist

- owner explicit;
- dimensions not conflated;
- module/public boundary correct;
- route/capability centralized;
- method/template catalog-driven;
- page does not call infrastructure;
- memory/HTTP adapters share port;
- authoritative success from command response;
- online redirect not trusted;
- COD collection/remittance separated;
- money decimal-safe;
- status metadata centralized;
- no hardcoded production financial data;
- no excessive bold typography;
- required UI states present;
- i18n/guidance updated;
- focused and aggregate checks pass;
- backend-only responsibilities stated honestly.

## Placement

Preferred:

```text
docs/ai/SKILLS.md
```

Add a mandatory-read pointer from `AGENTS.md`.

If tooling requires root `SKILLS.md`, update the repository naming allowlist and run the naming guard. Never bypass the guard.
