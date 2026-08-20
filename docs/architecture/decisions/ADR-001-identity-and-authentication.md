# ADR-001: Identity and authentication authority

> **Status:** ACCEPTED FOR BACKEND DESIGN  
> **Date:** 2026-07-17  
> **Decision scope:** Shared backend foundation

## Context

The current repository is frontend-only. It can obtain an access token from a host integration, display effective capabilities and fail closed when connected identity is unavailable. Browser session state, command metadata and UI capability checks cannot establish production identity or authorization.

## Decision

1. Production authentication uses an external identity provider through OIDC or an equivalent standards-based server session.
2. The backend validates the credential and derives the immutable identity subject. It never trusts `actor`, `actorId`, role names, capability sets or request timestamps supplied in a request body.
3. A backend `UserAccount` maps an identity-provider subject to application identity. Workspace access is resolved through `WorkspaceMembership`.
4. Authorization is evaluated server-side at every command and protected query boundary using membership, role/capability policy, data scope and record ownership rules.
5. The frontend may hide or disable actions for usability, but those checks are not security authority.
6. Audit records use server-derived actor, workspace, correlation ID and authoritative timestamp.
7. Production connected startup remains fail-closed when identity binding is absent or invalid.

## Consequences

- `window.__UNICORECRM_CONNECTED_RUNTIME__.getAccessToken` is an integration seam, not an authentication system.
- Generic command bodies contain business command data only.
- Backend tests must cover unauthenticated, expired, wrong-workspace and insufficient-capability cases.
- Service-to-service and background-worker identities require explicit principals; they cannot impersonate browser users implicitly.

## Verification evidence

- `src/app/bootstrap/applicationBootstrap.ts`
- `src/platform/api/client/FetchHttpClient.ts`
- `src/platform/api/runtime/HttpMutationAuthority.ts`
- `npm run quality:gate -- --gate quality.auth-session-contracts`
- `npm run quality:gate -- --gate quality.write-boundary-authorization`
- `npm run quality:gate -- --gate quality.contract-baseline`
