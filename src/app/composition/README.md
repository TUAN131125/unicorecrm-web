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

## AI Assistant capability

AI is a cross-cutting CRM application owner/capability, not one of the 15 business-domain modules. It is therefore wired through a runtime binding (`src/ai/runtime/aiRuntimeBinding.ts`) rather than through `ApplicationServiceBundle.modules`, in the same way as Studio core, access governance and the audit trail authority.

The AI Assistant owns AI conversations, AI insights, AI recommendations, AI action intents, AI frontend state, and the presentation/consumption of AI governance decisions. It does not own Customer, Contact, Organization, Deal, Task, Order, Quote, Support or any other CRM aggregate. Business mutations proposed by AI must pass through the target module's canonical command or workflow boundary — `CREATE_TASK` is routed to `activateAiSuggestedTask()` in `src/workflows/work-activation`, which calls the async Task command boundary.

Demo mode binds `DemoAiRuntime`, which reuses the browser mock engine and workspace/actor-scoped conversation storage. Connected mode binds `ConnectedAiRuntime`, which talks only to the product backend through the shared `HttpClient`; the frontend never depends on an external model provider and never holds provider credentials. Because no approved OpenAPI operation exists for the AI Assistant, connected AI operations currently reject with `CONTRACT_OPERATION_BLOCKED` (`DEC-AI-ASSISTANT-API`). Connected mode never falls back to the demo runtime; an unavailable AI backend is reported as an explicit UI state.

Connected AI requests carry workspace scope, actor scope, conversation id, the focused entity reference and a capability-filtered context projection. Record collections and financial values outside the effective data classes are never transmitted; the backend builds the authoritative CRM context behind its own access checks. Browser AI governance remains demo/support logic and is always marked `authority: "demo"`; it is never production authorization.
