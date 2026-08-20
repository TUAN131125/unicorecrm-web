# Record Retention and Destructive Actions

## Purpose

Unicore CRM preserves business history by default. A user-facing delete action must not physically remove a durable or referenced business record. Destructive actions are expressed as explicit lifecycle commands and executed through the mutation authority boundary.

## Retention classes

| Class | Examples | Allowed destructive lifecycle |
|---|---|---|
| `DURABLE` | Quote, Order, Invoice, Payment, Shipment, Return, commercial evidence, audit/activity | Archive, cancel, void or close according to the aggregate lifecycle. Never hard delete. |
| `MASTER` | Contact, Customer, Organization, Product | Archive or anonymize. Identity data may be redacted while relationship and transaction references remain. |
| `OPERATIONAL` | Lead, Deal, Task, Support work records | Archive or cancel while preserving audit and linked records. |
| `TRANSIENT` | Temporary import rows or uncommitted drafts with no business identity | Hard delete only after backend eligibility and authorization. |

## Hard-delete eligibility

A hard delete is permitted only when every condition is true:

1. The record is classified as `TRANSIENT`.
2. It is still a draft and has no committed business identity.
3. No other record references it.
4. No audit evidence must be retained.
5. The backend has explicitly authorized the deletion.
6. An operator-supplied reason is present.

The frontend does not calculate this eligibility from usage counters. It sends a command and the backend owns the final decision.

## Command boundary

Destructive operations follow the same authority flow as other business mutations:

```text
Presentation
  -> archive / anonymize / cancel / void command
  -> MutationAuthorityPort
  -> backend authorization, version check and transaction
  -> MutationOutcome with audit evidence
  -> authoritative query refresh
```

Demo mode uses `LocalMutationAuthority` behind the same contract. Connected mode sends the command envelope to the backend with workspace, actor, correlation, idempotency and expected-version metadata.

## Record-specific policy

- Contacts, Customers and Organizations are archived by default. Anonymization clears personal or identifying display data without breaking retained relationship references.
- Products are archived. Quotes, Orders and customer ownership history continue to reference the retained product identity.
- Leads, Deals and Tasks are archived rather than removed from persistence.
- Quotes and Orders are durable commercial records; archive only changes visibility, not history.
- Invoices and Payments use void, reversal, credit-note and cancellation commands appropriate to their lifecycle.
- Shipping and Returns use cancel, reject, resolve and close transitions; provider and evidence history remains retained.
- Commercial evidence and audit/activity records are append-only.

## Presentation rules

- Operator UI must say archive, cancel, void or anonymize rather than permanent delete.
- Presentation cannot call repository deletion functions or remove canonical records with array filtering.
- Presentation cannot decide hard-delete eligibility from local usage data.
- Every destructive command includes an explicit reason and actor context.

## Verification

Run:

```bash
npm run quality:gate -- --gate quality.record-retention-policy
```

The gate tests policy decisions, transient hard-delete eligibility, audit outcomes, durable repository ports, canonical command boundaries and the absence of legacy hard-delete APIs.
