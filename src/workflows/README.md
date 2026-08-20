# Cross-module workflows

A workflow belongs here only when one user/business operation coordinates two or more independent modules.

Current examples include:

- `acquisition-routing`: idempotent AcquisitionSignal resolution into Lead, existing Lead append, RelationshipSignal, or Signal Inbox;
- `lead-qualification`: Nurture, Opportunity, and Direct Sale outcome transactions;
- `contact-opportunity-creation`;
- `order-closing`: evaluates Payment/Fulfillment readiness, completes Order, and records PurchaseEvidence idempotently.

The arbitrary `lead-conversion` workflow is retired. Single-module commands must stay inside that module's `application/` layer.

Contact does not own opportunity progress, and Deal closing does not create Customer records. Deal stage transitions and terminal outcomes use canonical Deal commands; Quote Accepted or Order Confirmed provides WON evidence.

The legacy `order-completion` workflow is retired. Customer activation is projection-driven from Commercial Evidence.
