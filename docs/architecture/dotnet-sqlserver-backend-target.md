# .NET modular-monolith backend target

> **Status:** TARGET  
> **Authority:** Canonical backend technology and deployment target selected by the product owner.  
> **Scope:** Backend implementation that will consume the frontend OpenAPI contract.

## Decision

The production backend will be implemented as an **ASP.NET Core modular monolith** using:

- Clean Architecture boundaries;
- CQRS commands and queries;
- MediatR request dispatch and pipeline behaviors;
- FluentValidation at the application boundary;
- SQL Server as the durable relational database;
- Entity Framework Core for aggregate persistence and migrations;
- Dapper only for read projections where measured query requirements justify it.

The frontend does not depend on these implementation libraries. It depends only on the versioned HTTP/OpenAPI contract, authentication/session behavior, workspace context, error envelope, idempotency and concurrency semantics.

## Intended solution shape

```text
UnicoreCRM.sln
src/
  UnicoreCRM.Api
  UnicoreCRM.Application
  UnicoreCRM.Domain
  UnicoreCRM.Infrastructure
  UnicoreCRM.Contracts
  Modules/
    Contacts
    Organizations
    Customers
    Products
    Leads
    Deals
    Quotes
    Orders
    Invoices
    Payments
    Receivables
    Shipping
    Returns
    Support
    Tasks
```

A module remains part of one deployable monolith. Module boundaries are code and ownership boundaries, not network boundaries.

## Command path

```text
ASP.NET Core endpoint
  -> MediatR command
  -> validation behavior
  -> authorization behavior
  -> idempotency/concurrency behavior
  -> transaction behavior
  -> command handler
  -> domain aggregate
  -> EF Core / SQL Server
  -> audit + outbox in the same transaction
```

## Query path

```text
ASP.NET Core endpoint
  -> MediatR query
  -> query handler
  -> EF Core projection or Dapper read model
  -> OpenAPI response DTO
```

CQRS does not require separate databases. Commands and queries may use the same SQL Server database while keeping responsibilities and models explicit.

## SQL Server conventions

- Every tenant-owned table contains immutable `WorkspaceId`.
- Workspace-scoped uniqueness includes `WorkspaceId` in the index key.
- Mutable aggregates use SQL Server `rowversion`; the API exposes an opaque Base64 version through `ETag`/`If-Match` or the canonical `ResourceVersion` transport contract.
- Money uses .NET `decimal` and explicit SQL precision/scale. Transport amounts remain decimal strings.
- UTC instants use `DateTimeOffset`/`datetimeoffset`; business dates use `DateOnly`/`date`.
- Domain records use normalized relational tables. JSON is restricted to audit payloads, outbox/inbox payloads, provider metadata and controlled extension data.
- Actor identity, workspace access and authoritative time are resolved server-side.

## Frontend compatibility

The current React frontend remains compatible provided the .NET backend implements the declared OpenAPI operations and shared conventions. Generated TypeScript clients are technology-neutral and must not encode Node.js, PostgreSQL, EF Core, MediatR or SQL Server details.

The removed Node/PostgreSQL prototype was behavioral evidence only. It is not part of the frontend source baseline and is not an implementation authority for the .NET backend.
