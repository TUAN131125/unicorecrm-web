# Application composition root

This layer wires modules and replaceable platform adapters. It must not own business records or business rules. Connected mode creates all module/workflow services from one shared `HttpClient`; the host supplies only token, workspace, session and optional telemetry bindings. Demo composition is dynamically imported only for demo mode.

## Connected projection safety

Connected repositories are transitional read projections for existing synchronous presentation contracts. Direct writes fail with `CONNECTED_LOCAL_WRITE_FORBIDDEN`; only authoritative query loaders and committed server response projectors may update them. Loaded module resources refresh after mutation invalidation, and cross-module workflows invalidate every affected module.


## Connected command routing

Connected mode wires one shared module-data authority registry for all 15 business modules. Existing public command boundaries are routed to typed resource endpoints such as `/leads/{id}/change-work-state` and `/orders/{id}/confirm`; cross-module transactions use typed `/workflows/{workflow}/{id}/{operation}` endpoints. The generic `/commands` adapter remains compatibility-only and is not selected by the composition root.

Lead, Deal, Quote and Order public command boundaries attach the current version or `updatedAt` value as `If-Match` evidence and project the authoritative server response into their presentation repositories. Conflict responses are surfaced by a global shell dialog unless a feature owns a more specific recovery flow.

## Effective record access authority

Connected mode wires a fail-closed effective-access authority. Because no approved OpenAPI operation exists, connected evaluation currently rejects with `CONTRACT_OPERATION_BLOCKED`; frontend environment variables cannot supply an endpoint. The legacy evaluator remains demo-only and is not production authority.
Connected mode wires external-capability health as a fail-closed boundary. It currently rejects with `CONTRACT_OPERATION_BLOCKED` until an OpenAPI provider-health projection is approved; no handwritten or environment-defined path is allowed.
