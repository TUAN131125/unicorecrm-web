# Enterprise security and resilience contract

## Purpose

This document defines the security and resilience evidence implemented by the current Unicore CRM source package. It distinguishes source/runtime controls from evidence that still requires a production backend and operating process.

## Authentication and session assurance

- Administrative development accounts require an MFA challenge before an `AAL2` session is issued.
- Normal user sessions are `AAL1` unless an additional factor has been verified.
- The shared policy sets a 30-minute idle timeout, 12-hour absolute lifetime, five-minute MFA challenge lifetime, and five failed MFA attempts.
- Refresh may extend the idle boundary but never the absolute session expiry.
- Suspending a workspace member revokes that account's active sessions.
- A production Vite bundle fails closed when no explicit server-backed authentication adapter is configured. Demo credentials are not treated as a production identity provider.

The development MFA code is a local adapter fixture. It is not a production authenticator.

## Authorization and tenant isolation

Every mutation owner must authorize outside the presentation layer. The runtime authorization boundary checks:

1. An active authenticated session exists.
2. The actor has active membership in the active workspace.
3. The expected workspace matches the active workspace.
4. The required capability is granted.
5. The target record is in the same workspace.
6. The record is within the actor's effective data scope.

Denied authorization attempts append redacted tamper-evident evidence. Route guards remain a user-experience layer and do not replace mutation-boundary authorization.

## Tamper-evident audit evidence

Operational data, configuration, identity and authorization events append to a workspace- or identity-scoped SHA-256 hash chain. Each record contains:

- Sequence number.
- Previous-record hash.
- Canonical payload hash.
- Current record hash.
- Category, action, actor, subject and redacted metadata.

Canonical serialization follows browser JSON persistence semantics, including omission of undefined object properties. This prevents a valid record from failing verification after a local-storage round trip.

The current ledger is tamper-evident browser evidence. It is not an immutable external audit sink. Production acceptance requires append-only server storage, retention policy, access control, time synchronization and export/reconciliation procedures.

## Secret handling

- Integration configuration accepts only references such as `vault://`, `secret://` or `kms://`.
- Raw tokens, passwords, authorization values and API keys are rejected or redacted before audit and diagnostic output.
- Workspace backup excludes session, token, password, credential and secret keys.
- Production requires an external secret vault, rotation, envelope encryption and provider-specific access policy.

## Workspace backup and restore

The browser drill creates a workspace-scoped JSON archive with:

- Checksum per entry.
- Checksum for the complete archive.
- Explicit excluded-key list.
- Source workspace and creating account.

Restore is always planned before application. It is rejected when the archive checksum is invalid, the workspace differs, or a protected/cross-workspace key is present. Applying a valid restore appends a backup-category audit record.

This drill verifies source contracts and local recovery behavior. Production acceptance additionally requires encrypted server backups, retention, restore-point objectives, database transaction safety and a documented recovery drill.

## Integration resilience

Integration operations use a workspace-and-connector-scoped policy for:

- Idempotency and replay handling.
- Exponential retry.
- Rate limiting.
- Attempt evidence.
- Tenant boundary checks.

The Lead webhook development connector additionally requires verified authentication evidence, a bounded signature timestamp and an idempotency key before creating a Lead. It provides an end-to-end source-level connector proof, not evidence of a production provider connection.

## Offboarding

Suspending a workspace membership records an offboarding audit event and revokes sessions for the linked account. Reactivation is also audited. Production must additionally revoke external identity-provider sessions, API credentials, refresh tokens and managed-device access.

## Verification commands

```bash
npm run quality:gate -- --gate quality.auth-session-contracts
npm run quality:gate -- --gate quality.workspace-isolation-contracts
npm run quality:gate -- --gate quality.enterprise-security-evidence
npm run quality:gate -- --gate quality.write-boundary-authorization
npm run quality:gate -- --gate quality.integration-resilience
npm run quality:gate -- --gate quality.lead-webhook-connector
```

The administration activity log is available under People & Access → Activity log. It records member invitations, member status changes, role changes, permission changes, data-scope changes and field-access changes. Backup and restore remain separate platform/runtime concerns and are not presented as People & Access activities.

## Production acceptance boundary

The following claims are deliberately not made by the frontend source package:

- Immutable production audit storage.
- Database tenant isolation or row-level security.
- Production MFA provider enrollment and recovery.
- Encrypted production backups and successful database restore.
- Real secret-vault custody.
- A live third-party connector with provider-side retry and reconciliation.

These items require backend, infrastructure and operational evidence before P0-07 can be marked `ACCEPTED`.
