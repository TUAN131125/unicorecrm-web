# ADR-006: .NET modular monolith and SQL Server

> **Status:** ACCEPTED FOR BACKEND DESIGN  
> **Date:** 2026-07-17

## Context

The frontend contract is technology-neutral, while the production backend technology must be fixed before implementation begins. A previous repository-local Node/PostgreSQL prototype demonstrated selected behaviors but does not match the product owner's intended stack.

## Decision

The production backend will use ASP.NET Core as a modular monolith with Clean Architecture, CQRS, MediatR, FluentValidation, SQL Server and Entity Framework Core. Dapper may be used for read projections when justified by measured requirements.

The frontend repository remains frontend-only. It owns the OpenAPI contract candidate and generated TypeScript clients, but it does not contain a competing executable backend implementation.

## Consequences

- OpenAPI remains the transport boundary between frontend and backend.
- SQL Server `rowversion` supplies optimistic concurrency evidence.
- .NET `decimal` and explicit SQL precision/scale implement the accepted money policy.
- MediatR pipeline behaviors own validation, authorization, idempotency, transactions, logging and performance policies.
- Database schemas are normalized by module ownership rather than copied from browser repositories or generic JSON resource tables.
- Backend integration and architecture tests belong to the .NET solution, not the frontend quality pipeline.
