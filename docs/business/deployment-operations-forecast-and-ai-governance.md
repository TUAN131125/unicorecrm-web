# Deployment Operations, Forecast and AI Governance

This document defines the stable product and runtime contracts for workspace deployment operations, advanced sales forecasting, order-to-cash analytics and AI governance.

It describes the current source implementation. Browser-local evidence and frontend contracts do not replace durable backend services, scheduled analytics, identity-provider enforcement or provider-side audit.

## Studio replacement status

The previous setup presets, configuration sandbox, Workspace Health Check and global Studio configuration search have been removed with the old Studio implementation. They are not current product capabilities and must not be restored as compatibility surfaces.

Future workspace configuration is governed by `docs/product/studio-rebuild-roadmap.md` and backend-owned versioned contracts. Forecasting and AI governance below remain independent CRM/platform concerns.

## Advanced sales forecast

Forecasting groups open opportunities by the explicit categories:

- Commit;
- Best Case;
- Pipeline.

For a selected close-date period, the engine computes:

- deal count;
- unweighted amount;
- probability-weighted amount;
- owner breakdown;
- Commit amount;
- total and weighted pipeline.

Snapshots are workspace-scoped and retain the selected period and capture time. Trend views use historical snapshots rather than reconstructing history from the current Deal table.

Forecast accuracy compares the saved Commit prediction with actual Won amount for the same period. A zero-safe denominator prevents invalid percentages.

The current source uses browser-backed snapshots. Production acceptance requires durable scheduled snapshots, historical ownership, server-side data scope and reconciliation with the reporting store.

## Order-to-cash metrics

The current order-to-cash evaluator derives operational metrics only:

- order collection cycle from Order confirmation to the latest successful payment;
- delivery success rate from terminal shipping outcomes;
- COD reconciliation rate from successful COD/carrier transactions;
- return rate against eligible orders;
- refund cycle time from return request to resolution.

The order collection cycle is not accounting DSO. The current frontend contract already includes the official Invoices module, an Invoice-based Receivables read model, receivable entries, summary and aging buckets derived from issue dates, due dates, allocations and credit notes. This is frontend/demo or connected-adapter contract evidence, not proof of durable accounting data. Accounting DSO remains unavailable until the backend owns authoritative accounting dates, reporting periods, durable invoice/payment history and reconciliation policy.

Metrics return `null` when the available population is insufficient. The UI must display an unavailable state rather than inventing zero performance. Production acceptance requires backend timestamps, period rules, cancellation policy and reconciliation with operational data.

## AI governance

### Autonomy levels

AI actions are controlled by four levels:

- `L0_READ`: read-only analysis;
- `L1_RECOMMEND`: analysis, recommendations and drafts;
- `L2_INTERNAL_ACT`: controlled internal updates;
- `L3_CONTROLLED_EXTERNAL`: controlled external actions and destructive actions when policy permits.

An action is denied when any of the following applies:

- the kill switch is enabled;
- the requested action exceeds the autonomy level;
- the actor lacks the required capability;
- the action uses a disallowed data class;
- blocked fields are requested;
- required evidence is missing;
- human approval is required but absent.

### Data boundaries

The governance policy distinguishes:

- public data;
- internal data;
- customer personal information;
- financial data;
- restricted data.

Blocked field matching protects credential-like fields such as passwords, access tokens, refresh tokens and credential references. Product surfaces must not weaken the policy by stripping evidence or misclassifying data before evaluation.

### Action evidence and retention

Every evaluated action produces a decision with reasons and may be recorded in a workspace-scoped action log. Retention is policy-controlled between 1 and 365 days.

The browser log is useful for source-level behavior and pilot evidence but is not an immutable enterprise audit. Production acceptance requires server-side evaluation, tamper-resistant retention, provider request identifiers and approval evidence.

### Product integration

The AI Assistant respects the workspace kill switch. Recommendation requests and internal task creation are evaluated before execution. AI-created updates must still pass the underlying command capability and domain validation; AI governance is an additional control, not a replacement for authorization.

## Guidance and accessibility

The following stable guidance targets are maintained:

- `reports.advanced-forecast`;
- `reports.order-to-cash`.

All content and status labels must remain bilingual. Interactive controls must remain keyboard accessible, and blocked or unavailable states must explain the reason without exposing internal identifiers.

## Verification

The primary contracts are:

```bash
npm run quality:gate -- --gate quality.forecast-analytics
npm run quality:gate -- --gate quality.order-to-cash-metrics
npm run quality:gate -- --gate quality.ai-governance-contracts
npm run quality:gate -- --gate quality.guidance-contracts
npm run quality:gate -- --gate quality.guidance-runtime
```

These checks protect source behavior and user-facing contracts. They do not claim real-browser usability, server persistence, scheduled analytics, external AI execution or production security evidence.
