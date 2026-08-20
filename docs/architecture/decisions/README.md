# Architecture decision records

These ADRs are accepted design constraints for the backend foundation derived from the current frontend contract candidate. They describe decisions, not proof that a backend implementation already exists.

| ADR | Decision |
|---|---|
| [ADR-001](ADR-001-identity-and-authentication.md) | Identity and authentication authority |
| [ADR-002](ADR-002-workspace-tenancy.md) | Workspace tenancy and isolation |
| [ADR-003](ADR-003-money-and-rounding.md) | Money, currency and rounding |
| [ADR-004](ADR-004-concurrency-and-idempotency.md) | Concurrency, versions and idempotency |
| [ADR-005](ADR-005-workflow-transactions-and-events.md) | Workflow transactions, process managers and events |
| [ADR-006](ADR-006-dotnet-modular-monolith-and-sqlserver.md) | ASP.NET Core modular monolith and SQL Server |

Changes to an accepted ADR require a superseding ADR or an explicit status change. Endpoint paths and schemas are authoritative only where declared by `docs/api/openapi.json`; database schemas and undeclared operations remain pending backend design artifacts.
