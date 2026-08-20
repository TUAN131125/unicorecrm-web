# HTTP and API foundation

## Purpose

Connected adapters use one transport contract instead of defining module-local HTTP clients. The shared boundary owns request context, serialization, retry behavior and typed errors. For operations present in OpenAPI, generated clients own endpoint paths and transport DTOs; module adapters own explicit mapping into application/domain contracts.

Canonical files:

```text
src/platform/api/client/HttpClient.ts
src/platform/api/errors/ApiClientError.ts
src/platform/api/client/FetchHttpClient.ts
src/platform/api/client/httpSerialization.ts
```

## Connected composition

`src/app/composition/applicationComposition.ts` can create Payment, Invoice and Receivables HTTP adapters from one `HttpClient`:

```ts
await initializeApplicationComposition({
  mode: "connected",
  http: {
    baseUrl: "https://api.example.com/v1",
    accessTokenProvider: {
      getAccessToken: () => identityClient.getAccessToken(),
    },
  },
});
```

A caller may also provide an already configured `HttpClient`. Connected mode fails closed when neither an adapter override nor HTTP configuration exists. An authentication session identifier is metadata and must never be substituted for a bearer access token.

The browser entry point delegates to `src/app/bootstrap/applicationBootstrap.ts`. Local development defaults to `demo`; production defaults to `connected` and requires `VITE_API_BASE_URL` plus host-provided `getAccessToken()` and `getWorkspaceId()` bindings. The host does not inject application services; the composition root creates them from the shared transport. Missing production identity/API configuration fails closed before rendering.

## Request context

Authenticated workspace requests send:

- `Authorization: Bearer <access token>`;
- `X-Workspace-Id` from the active workspace provider;
- `X-Request-Id` for one transport attempt chain;
- `X-Correlation-Id` for end-to-end tracing;
- `Idempotency-Key` when a command owns a stable idempotency key;
- `If-Match: "<version>"` for optimistic concurrency.

Authentication and workspace context are required by default. Public or platform endpoints must opt out explicitly through the request contract.

## Retry policy

- `GET` requests may retry retryable network failures and statuses `408`, `429`, `502`, `503` and `504`.
- Mutations never retry unless the adapter marks the request `idempotent` and supplies an idempotency key.
- Version-only mutations without an idempotency key use `retry: "never"`.
- Cancellation is never retryable.
- Timeout failures are typed and retryable only when the request itself is retry-safe.
- `Retry-After` is honored within the configured maximum delay.

## Error envelope

The preferred server error shape is:

```ts
interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    businessBlockers?: string[];
    correlationId?: string;
    retryable?: boolean;
    details?: unknown;
  };
}
```

`ApiClientError` preserves the HTTP status, stable error code, field errors, blockers, correlation/request IDs and retryability. `classifyMutationFailure` maps this contract to the existing UI mutation states without comparing user-facing message strings.

## Serialization

- `Date` values become UTC ISO-8601 strings.
- `bigint` values become decimal strings.
- Non-finite numbers, circular values and unsupported functions/symbols are rejected before network I/O.
- Objects with `amount` and `currency` must carry the amount as a decimal string. Floating-point money is rejected.
- Empty `204`/`205` responses resolve as `undefined`.
- Invalid JSON responses produce `RESPONSE_DESERIALIZATION_FAILED`.

## Module coverage

Connected composition now creates application service bundles for all 15 registered modules. Payment, Invoice and Receivables use specialized generated OpenAPI clients. Commercial modules use the shared typed module/query and workflow authority; their declared operations remain generated and ownership-tracked while the shared boundary is a transitional adapter. Connected presentation repositories are projection caches only and reject direct local writes. New specialized adapters must depend on `@/platform/api`, map generated DTOs at the module infrastructure boundary and must not call `fetch` directly.

## Verification

```bash
npm run quality:gate -- --gate quality.http-api-foundation
npm run api:check
```

The gate exercises auth/workspace headers, tracing IDs, idempotency, expected versions, safe retry behavior, timeout, cancellation, serialization, error mapping, connected composition and the prohibition on direct `fetch` calls outside the shared transport.
