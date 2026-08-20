# Care Cases module

The internal module key remains `support` for route and persisted-data compatibility, but the business concept is **Care Cases / Phiếu chăm sóc**.

## Ownership

The module owns:

- the customer-care case lifecycle;
- customer/contact/related-record references;
- care category, priority, channel and assignee;
- customer conversation and internal notes;
- optional follow-up and explicit commitment due dates;
- case activity history.

## Boundaries

- A Care Case is not a Task. It never creates a mirror Task automatically.
- A concrete assigned action may be created explicitly as a Task and linked back to the Care Case.
- A Care Case does not receive a default checklist.
- Time commitments are optional. The module only evaluates commitment status when real due dates exist.
- `support` remains the compatibility module key; user-facing copy uses Care Cases / Phiếu chăm sóc.
