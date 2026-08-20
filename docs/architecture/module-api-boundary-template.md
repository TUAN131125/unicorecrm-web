# Module API boundary template

## Purpose

The platform centralizes transport and generated contracts while each business module owns the meaning of its queries and commands. New connected behavior must follow this boundary; existing shared runtime authorities are transitional and may only be replaced module by module without changing accepted behavior.

```text
presentation
  -> module application query/command port
  -> module infrastructure HTTP adapter
  -> generated OpenAPI client
  -> platform API client/transport
```

## Required module shape

Names may vary, but responsibilities must remain equivalent.

```text
src/modules/<module>/
  application/
    ports/
      <Module>QueryPort.ts
      <Module>CommandPort.ts
    queries/
    commands/
    models/
  infrastructure/
    http/
      <Module>HttpQueryAdapter.ts
      <Module>HttpCommandAdapter.ts
      <Module>ApiMapper.ts
      <Module>ApiErrorMapper.ts
  composition/
    create<Module>ConnectedRuntime.ts
  public/
    index.ts
```

## Ownership rules

The platform API owns HTTP mechanics, generated clients, stable transport errors, runtime validation, correlation metadata and the generated operation catalog. A module owns application inputs/results, DTO mapping, lifecycle semantics, operation-to-capability use, idempotency attempt scope, concurrency evidence and provider contract tests.

Presentation, domain, application and public barrels must not import generated clients, HTTP transport implementations or platform API runtime executors. Generated clients may be imported only by module/platform infrastructure and the application composition root.

## Port example

```ts
export interface LeadQueryPort {
  listLeads(input: ListLeadsInput): Promise<ListLeadsResult>;
  getLead(input: GetLeadInput): Promise<GetLeadResult>;
}

export interface LeadCommandPort {
  createLead(input: CreateLeadInput): Promise<CreateLeadResult>;
  qualifyLead(input: QualifyLeadInput): Promise<QualifyLeadResult>;
}
```

Ports use module-owned application types. They do not expose generated DTOs, HTTP status codes, headers, `fetch`, Axios or browser repositories.

## Adapter requirements

Each HTTP adapter must:

- reference a generated `operationId` represented in `docs/api/api-operation-catalog.json`;
- map application input to a closed request DTO;
- map generated response DTOs into module-owned application models;
- preserve resource version and correlation metadata;
- pass required idempotency and concurrency evidence;
- surface stable typed errors without message-based branching;
- reject missing authoritative response evidence;
- avoid UI state, React, browser persistence and cross-module transaction orchestration.

## Runtime requirements

The application composition root selects connected, demo or test implementations. Connected mode must fail closed when a production operation or adapter is unavailable. It must not fall back to browser repositories, fixtures or local storage after HTTP failure.

## Completion criteria

A module API boundary is complete only when all of the following hold:

1. Query and command ports are module-owned.
2. Connected adapters implement those ports.
3. Every production operation appears in the generated operation catalog.
4. Generated DTOs stop at the infrastructure mapper boundary.
5. Connected mode has no browser fallback or mixed authority.
6. Stable error, capability, workspace, idempotency and concurrency metadata are covered by tests.
7. Provider contract tests exercise authoritative request and response evidence.

## Reference implementation

The Lead module implements this template under `src/modules/leads/application/ports`, `src/modules/leads/infrastructure/http` and `src/modules/leads/runtime`. Its permanent contract is enforced by `quality.lead-api-boundary`. A transitional `ModuleDataAuthority` bridge is allowed only for existing shared consumers and must delegate queries to the module port while rejecting generic mutations.

