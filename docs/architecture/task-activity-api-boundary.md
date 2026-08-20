# Tasks & Activities API Boundary

Tasks and Activities use a module-owned application boundary. Presentation calls `TaskApiRuntime`; connected mode binds `TaskHttpApiAdapter`, which is the only Tasks consumer of `CommercialApiClient`. Browser repositories are demo/read-model projections only and synchronous snapshot mutations fail closed in connected mode.

Authoritative query operations: `listTasks`, `getTask`, `listActivities`.
Authoritative command operations: `createTask`, `completeTask`, `cancelTask`, `assignTask`, `rescheduleTask`, `archiveTask`, `logActivity`.

Task and related-activity projections are reloaded after workspace changes. Lifecycle mutations require idempotency and optimistic concurrency as declared by OpenAPI. Activity creation uses backend-owned IDs, actor identity, occurrence evidence and audit metadata.
