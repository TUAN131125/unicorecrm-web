# Frontend-to-backend readiness boundary

> **Status:** CURRENT  
> **Authority:** Canonical statement of what the frontend can and cannot be used to infer for backend implementation.  
> **Scope:** Shared frontend/backend planning.

## Purpose

This repository contains the frontend reference implementation, validated use cases, UI states, application ports, workflow names, capability keys, selected HTTP adapters and a versioned OpenAPI contract candidate. It contains no executable production backend and is not a canonical database schema.

Backend implementation must not copy browser repositories, compatibility DTOs, local audit evidence, demo seeds or presentation projections as durable server models.

## Runtime bootstrap

`src/main.tsx` awaits `src/app/bootstrap/applicationBootstrap.ts` before rendering.

- Local development defaults to `demo`.
- Production defaults to `connected`.
- A production demo requires the explicit `VITE_ALLOW_PRODUCTION_DEMO=true` escape hatch.
- Connected mode requires `VITE_API_BASE_URL` and host-provided `getAccessToken()` plus `getWorkspaceId()` bindings.
- Optional host callbacks cover session refresh, unauthorized notification, logout and telemetry.
- The host does not construct or inject `ApplicationServiceBundle`.
- Session identifiers are never converted into bearer tokens.
- Missing API, token or workspace authority fails closed before rendering.

The host binding is an integration seam, not an identity implementation. Production OIDC/session handling and workspace membership authority belong to the backend and hosting environment.

## Connected coverage

| Area | Frontend connected boundary | Current evidence |
|---|---|---|
| Application service composition | Complete for all 15 registered modules plus explicit platform/workflow bindings | `createConnectedApplicationServiceBundle()` creates services from one `HttpClient`; injected host bundles are rejected |
| Typed command registry | 173 commands classified | 152 production-ready, 17 blocked and 4 deprecated; blocked/local commands have no production operation mapping |
| Typed query registry | 162 queries classified | 63 production API, 66 composed read model, 27 frontend-local, 5 demo-only and 1 BFF candidate |
| Generated OpenAPI operation ownership | 270 operations: 236 ready / 34 blocked | Every operation has one owner, generated client, authorization/scope and operational policy; blocked operations have a decision ID and no 2xx response |
| Dedicated HTTP boundaries | Operation-specific adapters across platform and active business modules | Identity, Workspace, Access, Lead, relationship domains, Deal, Quote, Product, Order, Finance, Shipping, Returns, Support, Tasks and Studio use generated transport through dedicated adapters |
| Commercial module transport | Ready only where OpenAPI says ready | List/detail and typed mutations use generated clients; generic lifecycle/status mutations and unapproved configuration writes remain blocked |
| Collection and detail resources | Registry-declared queries only | Server search/filter/sort/paging and resource versions come from typed responses; unsupported queries fail before network rather than infer a URL |
| Financial workspaces/details | Typed operation coverage with explicit residual blockers | Invoice, Receivables, Payment Plan/Intent/Record, Credit Note and refund recovery contracts are declared; generic Payment/Customer Credit allocation remains blocked pending residual policy |
| Shipping and Returns | Dedicated query/command adapters and backend-owned workflow contracts | Booking/provider/tracking/COD and Return lifecycle operations are typed; provider execution and cross-module saga durability still require the real backend |
| Mutation outcomes | Strictly validated | Connected mode requires backend command/correlation IDs, aggregate/version/time/outcome and typed result; no frontend fabrication or generic success conversion |
| Demo/local authority in connected graph | Prohibited | Static import graph guard rejects demo factory, development auth, browser storage, local mutation authority and module runtime imports |
| Connected protocol integration | Reference-provider and local real-HTTP evidence present | 26 provider packs define 516 scenarios; reference-host success is contract evidence, not durable provider/database proof |
| Real backend/database/browser proof | Environment-gated | Generated-client and connected Playwright gates exist; production backend, SQL Server persistence and database restart durability require external execution |

Transitional projection repositories exist only to keep current synchronous presentation controllers stable. In connected mode they reject direct writes; authoritative queries and committed server results are the only allowed projection sources. UI-only preferences and downloads may remain client-owned.

## Canonical contract policy

`docs/api/openapi.json` is the versioned OpenAPI 3.1 authority for operations and schemas explicitly declared there. Markdown endpoint lists remain use-case inventories for undeclared operations.

Authority is interpreted in this order:

1. `docs/quality/release-identity.json` for release and scope;
2. OpenAPI operation-level metadata for HTTP contract and readiness;
3. closed decision JSON and transaction contracts for business semantics;
4. generated clients, catalogs and registries as deterministic derivatives;
5. Markdown summaries as guidance.

The decision ledger may retain an intentionally blocked generic operation after its replacement decision is closed. It must never classify a production-ready OpenAPI operation as blocked.

Before implementing an endpoint in the .NET backend:

1. reconcile the frontend use case to one command or query;
2. add a unique OpenAPI operation ID and schema;
3. reuse shared pagination, filtering, sorting, money, time, error, idempotency and concurrency conventions;
4. regenerate and verify the TypeScript client;
5. implement the ASP.NET Core endpoint/MediatR request without copying frontend domain models;
6. add .NET integration tests with SQL Server and browser acceptance against the deployed test host.

## Server-owned authority

The backend owns tenant isolation, actor identity, authorization, accepted time, audit, retention, idempotency, outbox/inbox processing, provider secrets, webhooks, scheduled jobs and durable state. Frontend capability checks, projection caches and browser audit/storage are UX/demo behavior only.

## Selected backend target

The accepted target is ASP.NET Core Modular Monolith + Clean Architecture + CQRS/MediatR + FluentValidation + SQL Server. See [.NET modular-monolith backend target](./dotnet-sqlserver-backend-target.md) and [ADR-006](./decisions/ADR-006-dotnet-modular-monolith-and-sqlserver.md).

## Remaining implementation work

- production OIDC/session and workspace membership authority;
- ASP.NET Core implementations for the reviewed OpenAPI and typed workflow boundaries;
- normalized SQL Server persistence and `rowversion` mapping;
- approved SQL precision/scale, per-document tax semantics and allocation residual policy before implementing blocked financial allocation operations;
- idempotency, audit, outbox and webhook inbox tables/workers;
- replacement of transitional projection caches where server-paged read models are preferable;
- provider integrations and scheduled jobs;
- execute the generated-client contract gate against a disposable real backend;
- execute connected Playwright journeys against that backend;
- prove SQL Server persistence across process/database restart, tenant isolation, concurrency, retry and load behavior;
- compatibility retirement based on the existing ledger.


Acceptance commands, environment inputs and evidence boundaries are defined in [`docs/quality/connected-backend-acceptance.md`](../quality/connected-backend-acceptance.md).
