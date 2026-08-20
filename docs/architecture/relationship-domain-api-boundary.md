# Relationship Domain API Boundary — Phase 13A

Release: `unicorecrm-web@0.23.20-contract.0`

Status: `IN_PROGRESS_QUERY_BOUNDARY_COMPLETE`

## Scope

Phase 13 treats Contacts, Customers, and Organizations as a relationship-domain group while preserving separate module ownership. This tranche establishes the production query boundary and backend-composed relationship projections. It does not promote the still-blocked mutation operations.

## Module ownership

| Module | Application port | HTTP adapter | Connected runtime | Demo runtime |
| --- | --- | --- | --- | --- |
| Contacts | `ContactApiRuntime` | `ContactHttpApiAdapter` | `createContactConnectedApiRuntime` | `createContactDemoApiRuntime` |
| Customers | `CustomerApiRuntime` | `CustomerHttpApiAdapter` | `createCustomerConnectedApiRuntime` | `createCustomerDemoApiRuntime` |
| Organizations | `OrganizationApiRuntime` | `OrganizationHttpApiAdapter` | `createOrganizationConnectedApiRuntime` | `createOrganizationDemoApiRuntime` |

Connected list/detail resources now call these dedicated module runtimes. They no longer depend on the generic `HttpModuleDataAuthority` query path for these three modules. Connected runtime has no browser query fallback.

## Backend-composed projections

The OpenAPI contract owns three permission-filtered read models:

- `getContactRelationshipSummary` — `GET /contacts/{contactId}/relationship-summary`
- `getCustomer360` — `GET /customers/{customerId}/360`
- `getOrganizationOverview` — `GET /organizations/{organizationId}/overview`

These operations are read-only, workspace-scoped, capability-protected, and explicitly designed to prevent frontend N+1 aggregation from becoming production authority. The legacy Customer 360 composer remains a demo compatibility projection until presentation cutover is completed.

## Contract semantics

All three projection operations require authenticated workspace context and return stable permission-filtered DTOs. Idempotency and optimistic concurrency are not applicable to these GET operations. Cross-workspace access is denied with `WORKSPACE_MISMATCH`; missing resources use `RESOURCE_NOT_FOUND`.

## Remaining Phase 13 work

Phase 13 is not complete and the three modules are not yet `READY_FOR_BACKEND_CONNECTION` as complete domains. Remaining work includes:

- typed create/replace/archive/anonymize/owner-assignment contracts;
- transactional duplicate resolution;
- append-only consent ledger operations;
- import/export authority;
- backend-owned relationship linking and account hierarchy mutations;
- presentation cutover for Customer 360, Contact relationship summary, and Organization overview;
- mutation provider packs and authoritative mutation responses.

Blocked OpenAPI operations remain fail-closed and are not opened through generic payloads.
