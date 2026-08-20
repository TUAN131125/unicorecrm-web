# Studio configuration roadmap

> **Status:** CURRENT  
> **Scope:** Canonical Studio, optional Quick Setup, and module-owned configuration

## Product boundary

Studio is an orchestration surface, not a configuration aggregate. It has no Overview page and no mandatory onboarding. `/w/:workspaceKey/studio` opens Quick Setup only when its state is `NOT_STARTED`, the user has `studio.configure`, and auto-open has not been dismissed. `/settings/quick-setup` remains visible and reopenable.

Quick Setup stores only status, current/completed/skipped step IDs, timestamps and revision. Business answers are saved directly to their owners.

## Navigation

- **Get started:** Quick Setup.
- **Workspace:** Business information, Language & region, Enabled features.
- **CRM data:** Pipelines & statuses, Product types, Information fields.
- **Finance:** Payment information, Invoice information.
- **Connections:** Integrations, Webhooks & API.

## Ownership

| Configuration | Authority |
|---|---|
| Business profile, address book, locale, currencies, exchange rates, feature visibility | Workspace Configuration |
| Pipelines, stages, object schemas and field capabilities | CRM Configuration / Deals |
| Product types and product fields | Products |
| Receiving accounts, VietQR, payment plans and credit policy | Payments |
| Seller information and invoice defaults | Invoices |
| Pickup/return projections and provider settings | Shipping / Integrations |
| Webhooks and API-key metadata | Platform Developer |
| Eight-step progress metadata | Studio Quick Setup |

CRM screens consume these same authorities immediately; Studio does not maintain a second snapshot.

## Currency and exchange-rate rules

- Currency selection uses the browser's ISO 4217 registry; the workspace seed is not a validation allow-list.
- Rates are positive decimal strings with effective timestamps, source, status and version.
- Preview conversion resolves the effective rate without mutating persisted transaction values.
- Quotes, Orders, Payment Agreements, Payments, Invoices and Refunds retain an immutable exchange-rate snapshot when conversion is applied.

## Connected API boundary

`docs/api/openapi.json` owns Workspace, Quick Setup, CRM, Product, Financial and Integration configuration endpoints. Every operation uses `X-Workspace-Id`; mutations use `If-Match` and `Idempotency-Key`; success responses expose `ETag`; errors use `ApiErrorEnvelope`. No configuration operation accepts workspace ID as a query parameter, browser actor claims or authoritative timestamps.

Connected composition creates generated clients for all six groups and fails closed without connected HTTP/identity bindings. Demo browser repositories are local-only.

In connected mode, the backend is the source of truth. The frontend must not hardcode product types, currency options, pipeline catalogs, or any other module-owned configuration.

## Acceptance

- One Studio route tree and one section registry.
- Quick Setup is optional, permission-aware, metadata-only and always reopenable.
- No `StudioConfigurationSnapshot`, `StudioArea`, `saveArea`, legacy gateway, old storage namespace or old settings route remains.
- Module forms, documents and pickers consume the same owner configuration edited in Studio.
- Read-only access disables mutations; unsaved changes participate in the shared navigation guard.
- Focused Studio gates, lint, typecheck, route checks, generated-client drift check and production build pass before handoff.
