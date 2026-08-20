# Module Ownership and Cross-Module Workflows

## Purpose

This document identifies the current business owner for each important state and the approved way to coordinate independent owners.

A module owns business truth. A workflow coordinates owners. A read model composes them for display.

## Current registered modules

The runtime registry contains:

```text
commercial-evidence
contacts
customers
deals
invoices
leads
orders
organizations
payments
products
quotes
returns
shipping
support
tasks
```

The canonical module inventory is derived from `src/modules/*/manifest.ts`, while runtime route wiring remains explicit under `src/app/router/workspaces/`.

## Ownership matrix

| Concept | Owner | Primary responsibility |
|---|---|---|
| Lead work state and qualification outcome | Leads | active/closed lead lifecycle, lead activities |
| Individual person | Contacts | person identity, communication and relationship fields |
| Customer lifecycle profile | Customers | lifecycle, health, segmentation, care ownership and canonical relationship linkage |
| B2B account | Organizations | organization identity, representatives, account relationship state |
| Opportunity | Deals | stages, next action, close evidence, loss/recycle decision |
| Quote | Quotes | versions, status, immutable sent/terminal content, revisions |
| Order | Orders | commercial identity, lines, recipient context and overall lifecycle; completion/failure decisions consume external evidence |
| Payment obligation/plan/transaction/refund success | Payments | terms, methods, obligations, balances, transactions and refund truth |
| Carrier booking/delivery evidence | Shipping | provider attempts, tracking, external status, `deliveredAt` |
| Return request | Returns | line quantities, eligibility, decision, receive and resolution intent |
| Purchase evidence | Commercial Evidence | append-only evidence for relationship/customer projections |
| Product | Products | catalog and product configuration |
| Support case | Support | case lifecycle and assignment |
| Task | Tasks | task lifecycle, assignment and completion |
| Customer 360 | Customers read model | read-only composition across identity and downstream owners |

## Cross-module rule

Put an operation under `src/workflows/` only when one business action must coordinate two or more independent owners.

A workflow must:

- consume module public APIs;
- preserve each module's invariants;
- use explicit commands and evidence;
- avoid owning a duplicate aggregate;
- remain framework-agnostic in its domain/application layers;
- expose a stable root `index.ts`;
- expose `public/index.ts` when it has a public contract directory;
- name root route-only entry files with the `*-route.tsx` suffix.

## Current workflows

The source currently contains 22 cross-module workflow directories:

```text
accepted-quote-order-conversion
contact-opportunity-creation
contact-organization-relationship
customer-care
customer-commercial-actions
customer-conversion
customer-identity
customer-onboarding
customer-relationship-integrity
deal-recycle
lead-qualification
order-cancellation
order-closing
order-confirmation
order-creation
order-shipping-booking
quote-acceptance
return-credit-refund
return-resolution
return-resolution-evidence
shipping-cod-evidence
work-activation
```

`docs/quality/repository-inventory.json` is the machine-readable authority for the current workflow directory inventory. The responsibility notes below describe the main orchestration boundaries and do not replace that generated list.

### Lead qualification

`src/workflows/lead-qualification/`

Coordinates Lead with Contact/Organization and optionally Task, Deal, Quote or Order.

Outcomes:

- Nurture;
- Opportunity;
- Direct Sale.

### Contact opportunity creation

`src/workflows/contact-opportunity-creation/`

Coordinates a Contact relationship with Deal creation without moving Deal ownership into Contact presentation.

### Deal recycle

`src/workflows/deal-recycle/`

Coordinates a LOST Deal recycle decision with follow-up work while Deal remains the owner of opportunity state.

### Quote acceptance and Order conversion

`src/workflows/quote-acceptance/` accepts the Quote and, when linked, closes the Deal as Won. It never creates an Order.

`src/workflows/accepted-quote-order-conversion/` is the separate idempotent boundary that creates exactly one `DRAFT` Order from an accepted Quote. Direct-sale draft creation remains owned by `src/workflows/order-creation/`.

### Order creation

`src/workflows/order-creation/`

Coordinates creation of a canonical `DRAFT` Order and a version-matched `DRAFT` Payment Plan. Order creation never creates Shipping inline. The user must confirm the Order through `order-confirmation`; that workflow activates the Payment Plan atomically and only then may the Shipping workflow evaluate fulfillment and payment gates.

### Order closing

`src/workflows/order-closing/`

Evaluates owner evidence and decides whether a confirmed Order may complete. Fulfillment and Payment settlement remain independent dimensions:

- required physical fulfillment completes only after all required Shipping attempt groups have canonical delivered evidence;
- provider and delivery-attempt failures remain evidence owned by Shipping and never become an Order `FAILED` state;
- only Payment Schedule lines whose explicit fulfillment gates block readiness are considered.

Generic Order state mutation must not bypass explicit confirmation, completion or cancellation boundaries. The commercial Order lifecycle is limited to `DRAFT`, `CONFIRMED`, `COMPLETED` and `CANCELLED`.

### Order shipping booking

`src/workflows/order-shipping-booking/`

Coordinates an eligible Order with creation of an outbound Shipping booking. It does not merge Order state with carrier state.

### Return resolution evidence

`src/workflows/return-resolution-evidence/`

Verifies downstream owner evidence before Returns may complete a resolution:

- refund resolution requires a successful Payment refund transaction;
- replacement resolution requires a `REPLACEMENT_OUTBOUND` ShippingBooking with canonical delivered evidence.

Returns records intent and lifecycle state; it does not manufacture Payment or Shipping success.

### Work activation

`src/workflows/work-activation/`

Coordinates source records with Task work when explicit follow-up activation is required.

## Read-side composition

Workspace read models may combine multiple owners for:

- Dashboard;
- My Work;
- Notifications;
- Reports;
- Customer View;
- relationship timeline;
- AI context.

Read-side composition must not write back into multiple module repositories directly. User actions route to the owning command/workflow.

## Removed active boundaries

The current product does not register active owners for:

```text
acquisition
campaigns
care
fulfillment
```

The CRM shell also does not expose Signal Inbox, Intake Operations, Sources & Campaigns, Sales Forecast, Price Books, Onboarding, Care Queue or Renewals as active product surfaces.

New code must not recreate these as hidden owners without a product and architecture decision.

## Canonical relationship resolution

Lead, Contact, Organization and Customer surfaces must not create parallel identity records for the same real-world person or organization.

Current rules:

- Lead remains a work/qualification record, never a buyer identity.
- Qualification resolves the Lead to one existing or newly-created canonical `Contact` or `OrganizationAccount`.
- New-contact resolution reuses an existing Contact when normalized email or phone matches; name-only matching is used only when stronger identifiers are absent.
- New-organization resolution reuses an existing Organization Account when tax code, domain, communication identity or exact normalized legal/display name matches the current resolution policy.
- The Customers module keeps one Customer profile per canonical `RelationshipRef`; Customer 360 composes Lead lineage plus downstream module records through that same relationship.
- Support may retain `customerId` for route/display compatibility, but current records also carry `relationshipRef` when the canonical relationship is known.

The shared matching policy lives under `src/platform/identity/`; module read models must not reimplement competing normalization rules.

## Relationship reporting

Relationship reports are read-side composition, not a new AI-owned aggregate.

The report surface:

- renders only sections supported by current data;
- does not require fixed "signals" or "next actions" blocks;
- keeps the default view compact;
- reveals deeper evidence, gaps and recommendations only on request;
- states data coverage from the modules actually linked to the relationship.

Recommendations are derived from current owner data and remain advisory. User actions still route to the owning module or workflow.
