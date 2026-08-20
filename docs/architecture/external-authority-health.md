# External Capability Authority and Provider Health

Status: **CURRENT frontend contract / TARGET backend authority**

## Purpose

A workspace capability in `EXTERNAL` mode is owned by an ERP, accounting platform, payment provider, carrier or another integrated system. The CRM must not infer provider availability from a Studio toggle or from the presence of historical browser data.

Connected mode requests a workspace-scoped provider-health decision from:

```text
GET /integrations/capability-health/{capabilityKey}
```

The connected adapter is deliberately blocked until OpenAPI defines the provider-health projection. Frontend environment variables cannot introduce a handwritten endpoint.

## Contract

The backend response owns:

- provider identity without exposing raw credentials;
- health status: `HEALTHY`, `DEGRADED`, `UNAVAILABLE`, `AUTHENTICATION_EXPIRED`, `SYNC_DELAYED`, `RECONCILIATION_REQUIRED` or `UNCONFIGURED`;
- CRM access mode: `READ_ONLY` or `BLOCKED`;
- last successful synchronization and health-check timestamps;
- token-expiry timestamp;
- synchronization lag;
- outstanding reconciliation count;
- reason codes suitable for operations and audit.

`sourceOfTruth` must be `EXTERNAL`. Native writes are never granted by this health response.

## Fail-closed rules

- Workspace and capability in the response must match the request.
- `UNAVAILABLE`, `AUTHENTICATION_EXPIRED` and `UNCONFIGURED` must return `BLOCKED`.
- Missing, malformed or cross-workspace responses are rejected.
- While provider health is unknown, the UI stays blocked and exposes retry plus a link to Integration Center.
- Demo mode returns an explicit `UNCONFIGURED/BLOCKED` projection; it is not production evidence.

## Presentation

`CapabilityUnavailableState` renders provider health only for `EXTERNAL` capabilities. The UI distinguishes healthy read-only access, degraded state, delayed synchronization, expired authentication, reconciliation requirements, provider outage and missing configuration. Provider-health state does not override the capability manifest or effective-record-access authority.

## Backend obligations

The backend must calculate health from durable connector state, webhook/inbox outcomes, sync cursors, credential lifecycle and reconciliation records. It must not return secrets, tokens or provider payloads in the health response.
