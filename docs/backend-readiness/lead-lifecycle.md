# Canonical Lead lifecycle

Contract version: `0.23.20-contract.0`. Source authority: `src/modules/leads/domain/model/leadLifecycle.canonical.ts` and `src/modules/leads/domain/rules/leadLifecycle.ts`. OpenAPI owns production command semantics.

| From | To | Command / operation | Outcome/type | Contract status |
| --- | --- | --- | --- | --- |
| NEW | CONTACTING | `lead.change-work-state` / `advanceLeadWorkState` | ACTIVE | READY |
| CONTACTING | VERIFYING | `lead.change-work-state` / `advanceLeadWorkState` | ACTIVE | READY |
| NEW, CONTACTING, VERIFYING | CLOSED | `lead.disqualify` / `disqualifyLead` | DISQUALIFIED | READY |
| VERIFYING | CLOSED | `lead.qualify-nurture` / `qualifyLeadForNurture` | NURTURE | READY |
| VERIFYING | CLOSED | `lead.qualify-opportunity` / `qualifyLeadForOpportunity` | OPPORTUNITY | READY |
| VERIFYING | CLOSED | `lead.qualify-direct-sale` / `qualifyLeadForDirectSale` | DIRECT_SALE | READY |
| CLOSED + DISQUALIFIED | CONTACTING | `lead.reopen` / `reopenDisqualifiedLead` | REOPEN | READY |

The generic `qualifyLead` operation is retired and remains blocked. Each positive outcome is a separate backend-orchestrated transaction. Connected frontend code may request one workflow but may not create downstream aggregates, calculate authoritative totals, coordinate compensation, or fabricate workflow evidence.
