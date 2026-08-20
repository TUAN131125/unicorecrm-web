# Customer Relationship and Commercial Flow

## Relationship identities

The current CRM relationship model has two canonical identity owners:

### Contact

Owns an individual person:

- name and person-level communication channels;
- communication restrictions and consent;
- role at company and decision role;
- relationship level;
- owner, follow-up and person-level notes.

### Organization Account

Owns a B2B account:

- display/legal identity;
- tax/domain/company contact data;
- industry and size;
- account status and relationship level;
- primary representative reference;
- representative Contact references.

A Workspace is not an Organization Account. A Customer profile links to a canonical Contact or Organization Account; it does not replace either identity owner.

## Organization and representative contract

Creating a B2B Organization through the current UI also creates or links a primary representative Contact.

The canonical links are:

```text
Contact.organizationAccountId
OrganizationAccount.contactRefs
OrganizationAccount.primaryContactId
```

The representative must have a name and at least one usable contact channel in the current create flow.

Organization commercial tabs resolve records using an Organization buyer reference. A representative Contact is not substituted as the B2B buyer owner.

## Customers and Customer 360

`customers` is an official registered module. A Customer owns relationship-level lifecycle, health, segmentation and care state linked to one canonical `RelationshipRef`. Customer 360 is the read-side composition surface and may combine:

- identity and relationship data;
- purchase evidence;
- orders and commercial history;
- support/work context;
- relationship timeline data.

It must not become a new write target.

## Lead lifecycle

Lead work state and qualification outcome are separate dimensions.

Current qualification starts from a Lead in the verifying state and ends through one explicit outcome.

### Nurture

Requires:

- a resolved Contact or Organization relationship;
- a reason;
- a revisit time.

Produces:

- a follow-up Task;
- a closed Lead outcome.

### Opportunity

Requires:

- Deal capability/module availability;
- concrete need/problem statement;
- owner;
- next action and due date;
- at least one manageable buying-motion signal such as buying window, estimated value, product fit or decision process.

Produces:

- a Deal starting in Discovery;
- a closed Lead outcome.

### Direct Sale

Requires:

- actor permission;
- the selected Quote or Order path to be available;
- at least one valid line item.

Produces either:

- a Draft Quote; or
- a Draft Order.

No Deal is required.

## Deal contract

Deal owns opportunity lifecycle.

Current stage semantics include:

```text
DISCOVERY
QUALIFIED
SOLUTION
PROPOSAL
NEGOTIATION
WON
LOST
```

Important invariants:

- open Deals require a next action timestamp;
- WON requires `QUOTE_ACCEPTED` or `ORDER_CONFIRMED` evidence;
- LOST requires a loss reason and recycle decision;
- a recyclable LOST Deal requires `revisitAt`;
- WON/LOST are explicit terminal commands.

## Quote contract

Quote owns document versions and status.

Important invariants:

- version is a positive integer;
- every Quote has `rootQuoteId` and canonical `buyerRef`;
- a Deal-path Quote has a Deal source;
- a Direct-Sale Quote does not require a Deal;
- sent/terminal versions are immutable in business content;
- changes require a revision rather than silent mutation.

## Order contract

Order owns:

- canonical buyer reference;
- commercial item snapshots;
- order state;
- recipient and shipping prerequisites;
- cancellation and completion audit references.

Order does not own:

- payment status;
- carrier execution state;
- tracking lifecycle.

Current states:

```text
DRAFT
CONFIRMED
COMPLETED
CANCELLED
```

`COMPLETED` is applied only through the Order Closing workflow and requires closing policy, correlation and purchase-evidence audit data.

## Purchase evidence and Customer lifecycle

Commercial Evidence stores append-only purchase evidence. The Customers module may create or update Customer lifecycle from approved purchase-evidence commands, while Deal, Quote and Payment must not activate or mutate Customer directly.

The evidence owner must not expose mutable replace/delete semantics for a completed purchase record.

## Organization UI contract

The current Organization workspace provides:

- table and card list modes;
- search and B2B filters;
- primary representative visibility;
- account statistics;
- permission-aware create/edit actions;
- detail tabs for overview, representatives, Deals, Quotes, Orders, work and support.

The detail surface resolves commercial records by canonical buyer reference and keeps person identity in Contact.

## One real-world entity, one canonical relationship identity

The CRM must not represent the same person or organization as independent duplicate identity rows across Lead, Contact, Organization and Customer.

The lifecycle is:

```text
Lead work record
  -> resolve to Contact or Organization Account
  -> keep the canonical RelationshipRef
  -> commercial/support/work modules link to that relationship
  -> Customers maintains the lifecycle profile and Customer 360 composes the full relationship history
```

Customer 360 is the most complete relationship surface, but completeness comes from composition rather than copying owner data. It may show:

- source Lead journey;
- Contact/Organization identity and representatives;
- Deals, Quotes and Orders;
- purchase evidence and purchased products;
- Payments, Shipping and Returns through related Orders;
- Support cases;
- Tasks and Activities.

Canonical linking uses `buyerRef` / `relationshipRef` first. Legacy `customerId` aliases are fallback compatibility only.

## Relationship integrity and migration safety

All new commercial, support and work writes resolve a Customer profile to its canonical `RelationshipRef` before committing. A legacy `customerId` remains a compatibility alias only; it may help read or migrate an older record, but it must not become the join key for a new relationship.

The transition strategy is **single write, dual read**:

1. new writes persist the canonical relationship and the current Customer profile reference;
2. read models may resolve legacy aliases while historical data is being reconciled;
3. reconciliation backfills canonical links without deleting source history;
4. ambiguous matches are reported for review and are never merged automatically;
5. compatibility reads can be removed only after integrity and reconciliation gates remain clean.

The relationship-integrity audit classifies findings as follows:

- `ORPHAN_RELATIONSHIP`: the Contact or Organization source does not exist;
- `CUSTOMER_RELATIONSHIP_MISMATCH`: a Customer alias and canonical relationship disagree;
- `DUPLICATE_CONTACT_IDENTITY`: normalized email or phone identifies multiple Contacts;
- `DUPLICATE_ORGANIZATION_IDENTITY`: normalized tax code or domain identifies multiple Organizations;
- `CROSS_WORKSPACE_REFERENCE`: a relationship crosses the active workspace boundary;
- `BROKEN_SOURCE_CHAIN`: Quote, Order, Payment, Shipping, Return or Support cannot trace to its owning source.

Errors block acceptance. Duplicate candidates are warnings and require human review. The migration contract must be deterministic and idempotent: running it again with the same inputs must not create additional identities or rewrite lineage differently.

## Customer 360 reconciliation contract

Customer 360 and Reports use the same canonical relationship population. For every Customer profile:

- Deal, Quote and Order buyer references equal the Customer relationship;
- Payment, Shipping and Return trace through an Order owned by that relationship;
- Support, Task and Activity carry the same relationship when they are Customer-scoped;
- Lead conversion history remains visible in the timeline;
- Customer totals, B2B/B2C totals and transaction segments reconcile with Reports;
- integrity warnings are visible to authorized users and do not silently alter identity.
