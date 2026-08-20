# Sales Quick Create and Pipeline Health

## Purpose

This contract reduces initial data entry without weakening ownership, relationship identity, lifecycle, or forecasting evidence. It covers Lead, Contact, and Deal creation plus the signals used to prioritize open opportunities.

## Quick Create principles

1. A new record must be usable for the next real action immediately after save.
2. The first form asks only for identity, a reachable channel, ownership, and the minimum context required by that workflow.
3. Advanced data is progressively disclosed. Users should not enter placeholder values merely to satisfy a large form.
4. Requirements become stricter as the record moves through its lifecycle.
5. Ownership is resolved by the authenticated command boundary. Presentation defaults are not an authorization control.
6. Saved records provide direct feedback and a route to open the created record.

## Lead contract

Quick Create requires:

- Lead name.
- At least one contact channel.
- Source.
- Owner.
- Next follow-up time.

Company and pain-point information become required when the Lead reaches verification states that need those facts. The complete form remains available for enrichment without blocking initial intake.

## Contact contract

Quick Create requires:

- Full name.
- At least one contact channel.
- Owner.
- Next follow-up time.

Organization information becomes required when the Contact is used for an open opportunity and the business relationship needs an organization anchor.

## Deal contract

Quick Create requires:

- Opportunity name.
- Canonical buyer relationship.
- Owner.
- Either a concrete customer need/problem statement or at least one interested product/service.

Expected value and target close date may be added when evidence exists; users must not enter placeholder values merely to save an early opportunity. A follow-up is created as an optional Task, which owns its title and due time. Proposal and Negotiation require forecast evidence, including positive value and forecast category. Terminal outcomes remain available only through the dedicated Won and Lost commands.

## Pipeline health

Every open Deal exposes:

- Days in the current stage.
- Days since the latest recorded activity.
- Missing or overdue next-step state.
- Stale state.
- Forecast category.

The current frontend thresholds are:

- Activity is stale after 14 days without an update.
- A stage is stale after 21 days without progression.

These thresholds are prioritization signals, not automatic lifecycle transitions.

## Forecast category

- `PIPELINE`: early or lower-confidence opportunity.
- `BEST_CASE`: meaningful evidence exists, but conditions remain.
- `COMMIT`: high-confidence opportunity, usually in negotiation or with strong probability evidence.

Forecast category does not replace stage, commercial acceptance, Order confirmation, or other closing evidence.

## Forecast history

Changes to expected close date, probability, or forecast category create history containing:

- Actor when available.
- Occurrence time.
- Previous and next close date.
- Previous and next probability.
- Previous and next category.

No-op edits do not create history. Duplicated opportunities start with a new stage clock and empty forecast history rather than inheriting the source record's forecast audit.

## Guidance contract

The user guidance system must retain these stable targets:

- `leads.form.quick-create`
- `leads.form.progressive-profile`
- `contacts.form.quick-create`
- `contacts.form.progressive-profile`
- `deals.form.quick-create`
- `deals.form.progressive-profile`
- `deals.form.next-step`
- `deals.form.forecast-category`
- `deals.pipeline.health-indicators`
- `deals.detail.forecast-history`

Content must remain bilingual and explain business intent before field position.

## Verification

```bash
npm run quality:gate -- --gate quality.sales-quick-create-contracts
npm run quality:gate -- --gate quality.leads
npm run quality:gate -- --gate quality.contacts
npm run quality:gate -- --gate quality.deals
npm run quality:gate -- --gate quality.deal-lifecycle-contracts
npm run quality:gate -- --gate quality.record-ownership-contracts
npm run quality:gate -- --gate quality.form-runtime-sizing
npm run quality:gate -- --gate quality.guidance-contracts
```

Automated source and domain checks do not replace browser pilot evidence. Acceptance requires measured creation time, abandonment rate, data completeness, mobile usability, and confirmation that users no longer need to return to spreadsheets or messaging tools for initial intake.
