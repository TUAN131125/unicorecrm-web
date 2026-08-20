# Frontend/backend readiness verification

> **Status:** CURRENT

The frontend source package is verified as a backend-technology-neutral handoff. It must not contain a competing executable backend implementation or wrong-stack database dependencies.

Run:

```bash
npm run quality:gate -- --gate quality.backend-readiness
npm run quality:gate -- --gate quality.frontend-backend-separation
npm run api:check
npm run quality:gate -- --gate quality.connected-acceptance-harness
npm run quality:gate -- --gate quality.connected-backend-integration
```

The checks verify:

- production frontend bootstrap fails closed without API/identity bindings;
- every Markdown file has document-status metadata;
- no `backend/` implementation exists in the frontend archive;
- Node/PostgreSQL backend dependencies and scripts are absent;
- OpenAPI generates only frontend TypeScript clients;
- ASP.NET Core Modular Monolith + Clean Architecture + CQRS/MediatR + FluentValidation + SQL Server is the accepted backend target;
- browser repositories and UI capability checks remain demo/UX evidence, never server authority;
- connected Payments, Invoices and Receivables adapters remain isolated behind application ports;
- the local connected host remains test-only and outside `src/**`;
- external backend/browser gates report `BLOCKED` without explicit environment evidence and never convert local-fixture PASS into production/database proof.
