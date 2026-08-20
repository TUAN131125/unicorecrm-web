# Shipping and Returns

## Boundary summary

Shipping, Returns, Orders and Payments are separate owners.

```text
Order
  owns commercial identity, lines, recipient context and overall lifecycle

Payment
  owns obligations, terms, methods, transactions and refund success truth

Shipping
  owns external booking, carrier state and delivery/failure evidence

Return
  owns return request lifecycle, line quantities and resolution intent
```

One module must not simulate another module's success state.

## ShippingBooking

The Shipping module owns `ShippingBooking`.

### Source and purpose

```text
sourceType:
  ORDER
  RETURN

purpose:
  ORDER_OUTBOUND
  RETURN_PICKUP
  REPLACEMENT_OUTBOUND
```

Shipping stores `sourceType`, `sourceId` and `purpose`. Order and Return do not need a single embedded `shippingBookingId` owner field in order to represent booking history.

A source may therefore have multiple attempts and provider changes without erasing durable history.

### Two independent status dimensions

Booking lifecycle:

```text
PENDING
BOOKED
FAILED
CANCELLED
```

External carrier lifecycle:

```text
UNKNOWN
ACCEPTED
WAITING_PICKUP
PICKED_UP
IN_TRANSIT
DELIVERED
DELIVERY_FAILED
RETURNED
CANCELLED
```

Provider synchronization updates external shipping evidence. It does not change Order state.

### Snapshot contract

A booking persists snapshots for:

- provider and service;
- pickup location;
- recipient and address;
- package;
- shipping fee;
- COD request amount.

Operational source records may change later, but the booking keeps the facts used for the external attempt.

### External side-effect safety

Create booking uses:

```text
idempotencyKey
attemptGroup
correlationId
```

The runtime persists a pending record before the external provider call and then records success or failure.

Rules:

- replay of the same idempotency key returns the existing durable attempt;
- retry creates a new attempt rather than mutating away the failed history;
- changing provider creates a new booking attempt;
- durable bookings are not hard-deleted.

### Order outbound gate

The order-shipping workflow permits outbound booking only from a confirmed Order.

```text
DRAFT       → reject
CONFIRMED   → evaluate fulfillment and payment gates
COMPLETED   → reject
CANCELLED   → reject
```

A new Order is persisted as `DRAFT` together with a version-matched `DRAFT` Payment Plan. `order-confirmation` changes both to `CONFIRMED`/`ACTIVE` atomically. Shipping creation remains a separate owner command and can run only after confirmation and gate approval.

### COD

`codAmount` is a request to the carrier to collect money. It is derived from outstanding COD obligations owned by Payment and is not Payment success.

COD is valid only when the owning Order has at least one physical-shipping line. Payment-plan writes require an explicit fulfillment context and reject COD for service-only or digital-only Orders. The Order form applies the same rule before submission; the command boundary remains authoritative.

Shipping may persist carrier collection-request evidence, but it must not create or infer a successful Payment transaction, mark an Order paid or settle the merchant balance.

### Delivery and fulfillment evidence

A canonical delivered booking has external status `DELIVERED` and a valid `deliveredAt`.

Order Closing reads required outbound Shipping attempt groups rather than a single arbitrary booking:

- every required group needs delivered evidence before a physical Order may complete;
- multiple required shipments must all complete;
- provider `FAILED` and carrier `DELIVERY_FAILED` remain transient/recoverable evidence and do not fail the Order;
- terminal outcomes such as `RETURNED` or carrier `CANCELLED` remain Shipping evidence and may block completion or require an explicit commercial cancellation decision.

Shipping records evidence. The Order Closing workflow may decide `COMPLETED`; Order cancellation is handled through its own readiness workflow. Shipping never creates an Order `FAILED` state or mutates Order state directly.

The same canonical delivered evidence is also used for replacement completion in Returns.

## Order creation and later Shipping

Order creation and Shipping are intentionally separate:

1. validate and persist a `DRAFT` Order;
2. persist the version-matched `DRAFT` Payment Plan;
3. return to Order detail for review;
4. confirm the Order through the explicit confirmation workflow, which activates the Payment Plan atomically;
5. create Shipping later from the confirmed Order when fulfillment and payment gates allow it.

Order creation never invokes a Shipping provider. Stable identifiers and idempotency keys prevent duplicate bookings when Shipping is retried after confirmation.

Shipping prefill comes from the persisted confirmed Order context: customer/contact recipient data, delivery address, Order lines/package information and outstanding COD schedule lines from Payment. The form initializes that context once and does not overwrite user edits during background refreshes.

## Shipping provider abstraction

Order and Return code do not call a provider-specific API.

The provider boundary includes:

- provider contract;
- provider registry;
- manual provider adapter;
- backend-owned provider configuration contract.

Provider configuration must store a credential reference through the backend authority, never raw secrets in frontend state.

Current frontend support proves the business boundary with a Manual adapter. Real provider APIs and webhook verification require backend implementation.

## Shipping list/create interaction

The create modal supports explicit close through:

- header close button;
- cancel button;
- backdrop;
- Escape.

A route may carry an `orderId` intent for a confirmed Order with at least one physical-shipping line. Service-only, digital-only, missing and non-confirmed Order contexts remain visible as an explicit issue; the page must not silently substitute another Order. The create-shipping action is hidden for non-physical Orders at both list and detail surfaces.

The page contract is:

1. memoize the confirmed-order collection used by the effect;
2. separate default selection from deep-link opening;
3. consume `orderId` once after a valid automatic open;
4. remove only that query parameter with replacement semantics;
5. preserve unrelated query parameters;
6. never reopen the modal immediately after the user closes it.

## ReturnRequest

The Returns module owns `ReturnRequest`.

### Lifecycle

Approved path:

```text
REQUESTED
→ APPROVED
→ AWAITING_ITEM
→ RECEIVED
→ RESOLVED
→ CLOSED
```

Rejection path:

```text
REQUESTED → REJECTED
```

### Line-level quantities

A Return references the original Order and each returned Order line.

For each line the model keeps:

- ordered quantity;
- previously accepted return quantity;
- requested quantity;
- received quantity;
- accepted/rejected quantity after inspection.

Requested quantity must not exceed the remaining returnable quantity.

The physical Return flow accepts only Order lines whose fulfillment kind is `PHYSICAL_SHIPMENT`. Service-only and digital-only Orders use their commercial adjustment/refund workflow instead of a parcel Return. Deep links preserve an invalid source as a visible issue and never silently switch to another Order.

### Original delivery evidence

The preferred eligibility evidence is a canonical delivered Shipping booking, recorded as the pair `deliveredAt` plus `deliveryEvidenceShippingBookingId`.

When Shipping evidence is unavailable, manual evidence is a structured object containing delivery time, reason, evidence reference, actor and creation time. A raw manually entered `deliveredAt` is not accepted as standalone evidence. All manual fields are required together and are retained for audit. A request without evidence may still be recorded as ineligible for review, but approval requires an explicit reasoned override.

### Eligibility is not approval

Eligibility is an evaluated result with reason and time. Approval/rejection is a separate human/business decision with its own actor, reason and timestamp.

An eligible request is not automatically approved.

### Receive confirmation

The Return is not considered received merely because a pickup exists.

Receive confirmation records actual operational evidence such as:

```text
receivedAt
receivedBy
receiveConditionNote
```

Resolution does not complete before the required receive/inspection step.

## Return resolution boundaries

### Refund

Return creates a Payment-target resolution intent.

The Return waits for Payment evidence that the refund transaction succeeded before the refund resolution is considered complete.

```text
Return intent pending
→ Payment performs/refers to refund
→ REFUND_SUCCEEDED evidence
→ Return may resolve
```

Return does not mark a refund successful by itself.

### Return pickup

A pickup uses Shipping with purpose:

```text
RETURN_PICKUP
```

Return stores the relevant booking reference/evidence but does not own carrier status.

### Replacement

Replacement outbound uses Shipping with purpose:

```text
REPLACEMENT_OUTBOUND
```

The Return waits for delivered Shipping evidence before replacement resolution is complete.

### Exchange and repair

Exchange and repair remain Return-owned resolution choices, while any external payment or shipping execution stays with the relevant owner.

## Future workspace configuration boundary

Carrier connections, service catalogs and pickup information will be supplied by backend-owned integration and workspace configuration contracts. The replacement Studio may administer those contracts through **Integrations** and relevant workspace information, but it does not own Shipping records or provider execution.

The frontend must not restore the removed provider/pickup Studio pages or a browser-owned carrier catalog as configuration authority.

## Product boundaries that are not active

The current runtime does not expose active CRM owners/surfaces for:

```text
Signal Inbox
Intake Operations
Sources & Campaigns
Sales Forecast
Price Books
Fulfillment
Onboarding
Care Queue
Renewals
```

Shipping and Returns must not be rebuilt as thin UI wrappers over any of these removed boundaries.

## Current infrastructure limits

The frontend uses browser/in-memory-oriented stores and a Manual shipping adapter.

Production deployment still requires backend ownership for:

- durable idempotency and concurrency control;
- provider webhook authentication/verification;
- outbox/retry processing;
- secret storage;
- tenant enforcement;
- authoritative persistence.
