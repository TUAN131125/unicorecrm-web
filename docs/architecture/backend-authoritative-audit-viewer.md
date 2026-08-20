# Backend-authoritative audit viewer

## Purpose

The audit viewer is separate from Tasks, Activities, Notes, and customer communication timelines. It presents immutable operational evidence supplied by the backend in Connected Mode and clearly labels browser-only evidence in Demo Mode.

The shared viewer covers record-level audit for Deal, Quote, Order, Payment, Invoice, and Return, plus workspace-level Studio and People & Access configuration/security evidence.

## HTTP contract

Connected Mode calls:

```http
GET /audit/events?resourceKey={resourceKey}&recordId={recordId}&cursor={cursor}&limit={limit}
```

Optional filters include `categories`, `outcomes`, `correlationId`, and `search`. Authentication and workspace headers are required. The backend derives the trusted actor and workspace from the request context and must not trust a workspace or actor supplied by the browser.

Response shape:

```ts
interface AuditTrailPage {
  workspaceId: string;
  items: AuditTrailEntry[];
  nextCursor?: string;
}
```

Each entry contains resource/record ownership, category, outcome, actor, timestamp, source, request/correlation/causation identifiers, changed fields, optional before/after payloads, and references to approval, automation, integration, provider, or export evidence.

## Fail-closed and privacy rules

The frontend rejects cross-workspace, cross-resource, cross-record, malformed category/outcome/actor, and invalid timestamp responses. Sensitive keys such as authorization, password, secret, token, API key, credential, cookie, and session are redacted before rendering even when a backend accidentally includes them.

The backend remains responsible for:

- append-only or otherwise tamper-resistant storage;
- trusted time synchronization and monotonic sequence assignment;
- retention, legal hold, tenant export, and immutable evidence policy;
- field-level redaction before data leaves the server;
- request, correlation, and causation propagation;
- approval, automation, integration, and provider evidence references;
- access control for `audit.read` and audited audit-export operations.

## UX boundaries

- Payment, Invoice, and Return expose the shared viewer within their existing detail audit/activity surfaces.
- Deal, Quote, and Order expose a lazy-loaded global audit drawer from the application shell.
- Studio and People & Access expose workspace/configuration audit through the same global viewer.
- Activity timelines remain business interaction records and must not be used as a substitute for audit evidence.
- Demo Mode maps the current operational audit store into the same view and labels it as browser-level evidence only.

## Deployment

Configure the endpoint with:

```env
Audit trail connected queries are blocked until an OpenAPI operation is approved; no frontend path override is supported.
```
