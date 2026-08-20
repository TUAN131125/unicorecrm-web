# Presentation Responsibility

## Purpose

Large CRM screens use explicit presentation composition so route/page entrypoints remain orchestration boundaries rather than mixed state, business-action and rendering owners.

The protected composition is:

```text
page or exported form entry
→ controller hook
→ dedicated view
→ focused existing sections, dialogs and list/detail components
```

Customer detail tab composition uses a focused tab orchestrator plus owner-specific relationship, sales, transaction, service and work sections.

## Entrypoint responsibility

A page or exported form entry may:

- receive route or parent props;
- initialize its controller hook;
- render not-found routing states when required;
- pass the controller result to its dedicated view.

It must not own:

- business mutation implementation;
- browser persistence;
- large field/state collections;
- table column renderers;
- pricing or transition calculations;
- modal and section markup for the full workspace.

## Controller responsibility

Controller hooks own presentation orchestration:

- route and query parameters;
- application queries and commands;
- transient interaction state;
- validation and form submission coordination;
- derived view data;
- navigation callbacks and authoritative refresh actions.

Controller hooks are render-free. They do not return JSX and do not import concrete browser persistence. Business truth continues to belong to module application/domain boundaries.

## View responsibility

Views own rendering and UI composition:

- page headers and toolbars;
- tables, cards and responsive layouts;
- status and payment badge renderers;
- form sections and action surfaces;
- dedicated modal/view components already owned by the module.

Views receive a typed controller result. They do not read local/session storage and do not select infrastructure adapters.

## Protected screens

The responsibility contract currently protects:

- Quote Builder;
- Contact List and Contact Detail;
- Deal Detail;
- Lead Detail and Lead Form;
- Order List and Order Form;
- Customer detail tab composition.

Deal Detail now uses a thin view composition with focused header, pipeline, quote, activity, sidebar and dialog owners. The controller remains render-free and no section selects persistence adapters.

The logical source used by source-level quality contracts is the entrypoint plus its controller/view or section companions. This keeps existing behavioral assertions authoritative after file responsibility is separated.

## Verification

```bash
npm run quality:gate -- --gate quality.presentation-responsibility
npm run quality:gate -- --gate quality.large-file-responsibility
npm run quality:gate -- --gate quality.maintainability-contracts
npm run quality:gate -- --gate quality.architecture
```

`quality.presentation-responsibility` protects thin entrypoints, companion existence, line budgets, render-free controllers and persistence-free views. Source-level UI contracts use `scripts/lib/presentationCompositionSource.mts` so they validate the complete presentation composition rather than assuming all behavior lives in one file.
