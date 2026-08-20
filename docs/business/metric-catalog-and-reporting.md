# Metric Catalog and Reporting Contract

## Purpose

Dashboard and Reports must use the same metric definitions and source-record rules. A displayed number is not considered trustworthy unless a user can understand its formula, period, timezone, included states, freshness, permissions and source records.

## Metric definition

Each metric is registered in `src/workspaces/crm/metrics/domain/metricCatalog.ts` and declares:

- stable metric ID;
- bilingual title, description and formula;
- source modules;
- included business states;
- business date field;
- value kind;
- required capabilities;
- period or current-snapshot mode;
- owner and version.

Metric calculations live in `src/workspaces/crm/metrics/application/metricEngine.ts`. Dashboard and Reports must not reimplement the same formula locally.

## Period and timezone

Period metrics support current month, current quarter, current year and all time. Date membership is evaluated using the workspace timezone configuration. Snapshot metrics are explicitly marked as current-state values and do not pretend to belong to a historical cohort.

When a comparison denominator is zero, the system reports the comparison as unavailable. It must not fabricate a percentage change.

Currency values use the workspace base currency. Locale affects formatting only; it must not change the currency or apply a hard-coded exchange rate. Source timestamps and record dates in metric drill-downs use the workspace timezone.

## Drill-down

A KPI opens a metric drawer that displays:

- current value and numerator/denominator where applicable;
- formula;
- selected period and workspace timezone;
- last source update;
- source modules and business date field;
- included states;
- navigable source records.

Source rows remain subject to the user's capability and workspace-scoped repository access.

## Funnel contract

The conversion funnel is cohort based. The cohort starts with Leads created in the selected period. Later stages include only records traceable to those Leads through canonical lineage:

```text
Lead → Deal → Quote → Order
```

Stage counts represent unique cohort Leads that reached the stage. Source record IDs remain available for reconciliation.

Deal, Quote and Order status distributions are independent current snapshots. They must be labeled as such and must never be presented as a conversion funnel.

## Change contract

When a status, date field, source relationship, permission or formula changes:

1. update the Metric Catalog and metric engine together;
2. increase the metric version when historical interpretation changes;
3. update Dashboard, Reports and guidance content;
4. update contract fixtures and reconciliation assertions;
5. run the metric catalog, drill-down runtime, Reports runtime, read-model, guidance and route-query gates.
