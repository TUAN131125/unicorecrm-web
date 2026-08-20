# Stage 7 — Large-file and presentation-responsibility cleanup

> **Status:** CURRENT  
> **Verified against:** `unicorecrm-web@0.14.0-contract.0`  
> **Scope:** Frontend maintainability; no backend implementation is included

## Outcome

Stage 7 reduces mixed-responsibility source files without changing CRM behavior or the provisional OpenAPI contract for the ASP.NET Core/SQL Server backend.

The Deal detail workspace no longer owns the entire header, commercial workspace, activity timeline, sidebar and modal tree in one view. `DealDetailView.tsx` is now a thin composition entry that delegates to focused rendering owners. The existing controller remains the orchestration authority and the module application/domain boundaries remain unchanged.

The former `aiMockEngine.ts` monolith is now a stable barrel over focused modules for question routing, focused-customer reasoning, message drafts, insight generation and shared formatting/action helpers. AI governance and evidence rules are unchanged.

## Protected composition

```text
DealDetailPage
→ useDealDetailController
→ DealDetailView
   ├── DealDetailHeaderSection
   ├── DealDetailCommercialWorkspace
   │   ├── DealDetailPipelineWorkspace
   │   └── DealDetailQuoteWorkspace
   ├── DealDetailActivityTimeline
   ├── DealDetailSidebar
   │   ├── DealDetailSidebarActions
   │   └── DealDetailRelatedRecords
   └── DealDetailDialogs
```

```text
aiMockEngine barrel
├── askCrmAi
├── focusedCustomerAi
├── aiMessageDrafts
├── aiInsights
└── aiMockEngine.shared
```

## Non-goals

- No business rule or transport DTO was redesigned.
- No React screen was switched to a backend implementation.
- No ASP.NET Core, MediatR, FluentValidation or SQL Server source is included.
- Large translation catalogs and remaining feature/controller files are not split merely to reduce line counts; future decomposition requires a responsibility boundary and executable evidence.

## Permanent verification

```bash
npm run quality:gate -- --gate quality.presentation-responsibility
npm run quality:gate -- --gate quality.large-file-responsibility
npm run quality:gate -- --gate quality.maintainability-contracts
npm run quality:gate -- --gate quality.opportunity-presentation-contracts
npm run quality:gate -- --gate quality.ai-governance-contracts
```

The guards enforce thin composition entries, focused line budgets, zero dependency cycles and a non-regressing large-file inventory.
