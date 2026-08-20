# Application composition and replaceable adapters

## Purpose

The application composition root is the only production source layer allowed to select concrete browser, development-memory or connected adapters. Business modules expose application service bindings and public operations; they do not select concrete repositories themselves.

## Runtime flow

```text
main.tsx
  -> await bootstrapApplicationComposition()
      -> resolve environment + host runtime bindings
      -> await initializeApplicationComposition()
          -> demo: dynamically import browser/development composition
          -> connected: create one shared HttpClient
              -> createConnectedApplicationServiceBundle()
                  -> 15 module application-service bundles
                  -> 5 workflow service bundles
                  -> workspace services
              -> typed module query/command authority registry
              -> generated configuration clients
              -> effective-access, provider-health and audit authorities
  -> render React application
```

The deployment bootstrap is `src/app/bootstrap/applicationBootstrap.ts`. The adapter composition root is `src/app/composition/applicationComposition.ts`. Demo composition is dynamically imported only in demo mode, so connected production imports do not statically pull demo repositories, development identities or browser persistence into their dependency graph.

## Host runtime contract

The connected host provides runtime/session facts only:

```ts
interface ConnectedRuntimeBindings {
  getAccessToken(): string | undefined | Promise<string | undefined>;
  getWorkspaceId(): string | undefined;
  refreshSession?(): boolean | Promise<boolean>;
  onUnauthorized?(): void | Promise<void>;
  logout?(): void | Promise<void>;
  telemetry?(event: ConnectedRuntimeTelemetryEvent): void | Promise<void>;
}
```

The host does **not** provide an `ApplicationServiceBundle`. Connected startup rejects an injected bundle and creates HTTP-backed application services itself. Missing API, access-token or workspace authority fails closed before React renders.

## Module contract

Each registered business module owns an `application/composition/*ApplicationServices.ts` contract. It declares the dependencies needed by public operations and exposes:

- a configure function used by the composition root;
- a typed getter for controlled integration and tests;
- application-port proxies used by the existing public facade.

Public module files may import application composition bindings, domain contracts, commands and queries. They may not import `runtime/` or concrete infrastructure.

Connected composition configures all 15 registered module service bundles. Transitional projection repositories preserve existing synchronous presentation contracts, but direct local writes throw `CONNECTED_LOCAL_WRITE_FORBIDDEN`. Only an authoritative backend query or committed command response may project data into them. UI preferences and client-side file export remain client concerns and are not business-record authority.

## Query, command and workflow authority

- Collection and detail reads use the typed module-data authority registry and authoritative resources.
- Loaded resources subscribe to module invalidation and refresh after committed mutations.
- Module commands route to typed resource operations with idempotency and optional `If-Match` evidence.
- Cross-module commands route to typed workflow paths and invalidate every affected module.
- Backend `occurredAt`, version, emitted events, correlation IDs and audit evidence are preserved in `MutationOutcome`.
- HTTP `409` and `412` are classified as version conflicts for reload/recovery flows.
- Local workflow implementations in the connected service bundle fail closed; they cannot become an accidental browser write authority.

Financial operations use specialized generated-client adapters. Commercial modules use the shared typed module/workflow authority while their declared OpenAPI operations remain generated and ownership-tracked. This is frontend boundary evidence, not proof that a matching backend endpoint has been deployed.

## Runtime modes

- `demo`: browser-backed and development-memory adapters preserve approved local behavior. Local development defaults to this mode.
- `connected`: production default. The frontend creates HTTP application services from one transport and narrow runtime providers.

A deliberately published production demo must set both `VITE_RUNTIME_MODE=demo` and `VITE_ALLOW_PRODUCTION_DEMO=true`. Connected startup obtains access tokens and active workspace identity only from `window.__UNICORECRM_CONNECTED_RUNTIME__`; frontend session IDs are never bearer tokens or tenant authority.

## Testing

Node quality checks that need demo composition preload the test-owned fixture `tests/fixtures/runtime/bootstrap-demo-application-composition.mjs`, which awaits asynchronous initialization. Connected architecture tests import only connected roots and reject static reachability to demo composition, `DevelopmentAuthAdapter`, browser storage, local mutation authority, local storage and module `runtime/` owners.

The primary gates are:

```bash
npm run quality:gate -- --gate quality.application-composition
npm run quality:gate -- --gate quality.routed-mutation-authority
npm run quality:gate -- --gate quality.authoritative-module-adapters
npm run quality:gate -- --gate quality.http-api-foundation
```

## Permanent rules

1. Concrete runtime wiring belongs only in the application composition root and infrastructure adapters.
2. The connected host supplies runtime/session bindings, never application services.
3. Module public boundaries must not import runtime or infrastructure.
4. Connected business-record writes execute through backend mutation authority and fail closed otherwise.
5. Connected production imports must not statically include demo identities, demo repositories, browser storage or local mutation authority.
6. Generated transport DTOs remain outside domain and presentation contracts.
7. Demo adapters remain available only through the explicit demo composition path until separately retired.
