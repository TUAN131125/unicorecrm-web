# Platform API boundary

`src/platform/api` owns technology-level API concerns shared by all modules:

- `generated/`: deterministic OpenAPI clients; never edited by hand.
- `client/`: HTTP transport, authentication/workspace headers, timeout, cancellation, retry and serialization.
- `errors/`: typed transport/application error translation.
- `contracts/`: generated runtime request/response and command/query registries.
- `catalog/`: generated operation ownership and delivery metadata.
- `runtime/`: transitional shared executors and application-composition helpers.
- `module-boundary/`: business-agnostic types used to describe module-owned query/command runtimes.

Business semantics do not belong here. Each module owns its application ports, HTTP adapters and DTO mappers. Presentation, domain and application layers must not import generated clients or platform API runtime implementations.

## Reference module migration

Lead is the first module migrated from the transitional shared authorities to dedicated application ports and HTTP adapters. `HttpModuleDataAuthority` and `RoutedHttpMutationAuthority` remain transitional for modules not yet migrated; they are not the connected runtime owner for Lead list, detail or create.

