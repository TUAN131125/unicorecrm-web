# Identity authentication and session contract

Contract version: `0.23.20-contract.0`.

## Decision

- Identity/Auth is a workspace-independent platform boundary. Login, MFA, account registration, email verification, password recovery and session bootstrap must work before a workspace is selected.
- OpenAPI is the production contract authority for ten Identity operations.
- The frontend composes `IdentityApiClient` through `IdentityAuthHttpAdapter`; authentication pages call the asynchronous application boundary and never call generated clients or HTTP transport directly.
- Access tokens are held only in adapter memory. They are not written to localStorage, sessionStorage or the persisted `AuthSession` projection.
- Refresh is cookie-assisted (`credentials: include`). The backend owns refresh-token rotation, credential validation, session revocation and all security evidence.
- Connected startup may render an unauthenticated Login route without a host-injected token. Host bindings remain optional deployment overrides, not the default Identity authority.
- Connected mode never falls back to development accounts or browser identity when the Identity service fails.
- Connected authentication stops at the workspace-selection boundary. Browser workspace memberships are not trusted in connected mode; the typed Workspace Bootstrap API owns authoritative membership listing, selection and context propagation.

## Production-ready operations

| Operation | Method and path | Authentication | Idempotency | Concurrency |
| --- | --- | --- | --- | --- |
| `signIn` | `POST /auth/sessions` | Public | Required | Backend serialized |
| `verifyMfa` | `POST /auth/challenges/{challengeId}/verify` | Public | Required | Backend serialized |
| `getCurrentSession` | `GET /auth/session` | Bearer | Not applicable | Not applicable |
| `refreshSession` | `POST /auth/session/refresh` | Public cookie-assisted | Required | Backend serialized |
| `signOut` | `POST /auth/session/logout` | Bearer | Required | Backend serialized |
| `registerAccount` | `POST /auth/accounts` | Public | Required | Backend serialized |
| `verifyEmail` | `POST /auth/email-verifications` | Public | Required | Backend serialized |
| `requestPasswordReset` | `POST /auth/password-reset-requests` | Public | Required | Backend serialized |
| `resetPassword` | `POST /auth/password-resets` | Public | Required | Backend serialized |
| `acceptWorkspaceInvitation` | `POST /auth/invitations/accept` | Bearer | Required | Backend serialized |

## Runtime composition

```text
Auth page
  → asynchronous Identity runtime API
  → ConnectedAuthGateway
  → IdentityAuthHttpAdapter
  → generated IdentityApiClient
  → FetchHttpClient with cookie credentials
  → backend Identity service
```

The authenticated business API client obtains its bearer token from the in-memory connected Identity runtime. On a business API `401`, the centralized handler attempts cookie-assisted refresh once, then clears the local session and invokes optional host logout callbacks.

## Fail-closed rules

- No `VITE_API_BASE_URL`: connected startup fails.
- Production cannot select the development authentication adapter.
- Identity failure does not become development success.
- Missing/expired access token does not trigger browser-repository fallback.
- Connected workspace selection does not read browser membership authority.
- Account-wide session administration remains blocked until the Users/Roles/Access Control phase.
- Workspace listing, selection and workspace-context propagation must use the ready Workspace Bootstrap API and may not fall back to browser membership data.

## Evidence

- OpenAPI: `docs/api/openapi.json`
- Generated client: `src/platform/api/generated/identityApi.ts`
- Application port: `src/platform/identity-auth/application/ConnectedAuthGateway.ts`
- HTTP adapter: `src/platform/identity-auth/infrastructure/IdentityAuthHttpAdapter.ts`
- Runtime: `src/platform/identity-auth/runtime/authRuntime.ts`
- Connected bootstrap: `src/app/bootstrap/applicationBootstrap.ts`
- Architecture guard: `tests/quality/architecture/check-identity-auth-api-boundary.mts`
- Provider pack: `tests/fixtures/backend-contract/identity-auth/provider-scenarios.json`
- Provider runner: `tests/contract/provider/run-identity-auth-provider-contract.mjs`

## Remaining external proof

The frontend contract and runtime are ready for connection only. Production acceptance still requires a real Identity provider/backend, durable session and refresh-token storage, secure cookie configuration, live revocation, browser E2E and security testing.
