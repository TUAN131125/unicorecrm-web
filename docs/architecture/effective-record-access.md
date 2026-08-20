# Effective record access authority

## Status

**CURRENT** frontend contract and connected-runtime enforcement boundary. The backend endpoint remains an integration contract to implement in the target service.

## Purpose

Connected mode must not infer production authorization from route visibility, frontend role labels, owner/team field-name heuristics or missing field policies. Before a protected detail or mutation surface renders, the frontend requests an effective decision for the current workspace, resource and optional record.

The default endpoint is:

```text
GET /access/effective-record-access/{resourceKey}
```

The connected adapter is deliberately blocked until OpenAPI defines the operation and response projection. Frontend environment variables cannot override an operation path.

## Request contract

The shared HTTP authority sends:

- workspace identity through the required workspace transport header;
- bearer access token through the shared HTTP client;
- `recordId` when evaluating an existing record;
- comma-separated requested command keys;
- comma-separated requested field keys;
- explicit export and approval decision requests.

The request is idempotent, cancellable and uses the shared retry policy for safe reads.

## Response contract

The backend response must contain:

```ts
interface EffectiveRecordAccess {
  workspaceId: string;
  resourceKey: string;
  recordId?: string;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
  allowedCommands: string[];
  fieldAccess: Record<string, "READ_WRITE" | "READ_ONLY" | "MASKED" | "HIDDEN">;
  decisionReasons: Array<{
    code: string;
    effect: "ALLOW" | "DENY" | "LIMIT";
    message?: string;
    source?: string;
  }>;
  evaluatedAt: string;
}
```

The frontend rejects responses whose workspace, resource or record identity does not match the request. Invalid booleans, field modes or decision effects are treated as malformed authority responses.

## Enforcement rules

1. Connected mode is fail closed. Missing, failed, stale or malformed decisions do not preserve a previous ALLOW decision.
2. `canRead=false` prevents the protected detail/form subtree from mounting.
3. A required command must be present in `allowedCommands`; broad update permission alone is insufficient.
4. Quote and Order action models combine existing presentation prerequisites with backend command decisions.
5. Field scopes enforce `HIDDEN`, `MASKED`, `READ_ONLY` and `READ_WRITE` on high-risk Quote and Order form groups. Backend DTOs remain responsible for actual masked values.
6. Route/sidebar visibility is product navigation only; it is never authorization evidence.
7. Demo mode keeps the existing local evaluator solely to preserve the approved browser-backed product demonstration.

## Covered frontend surfaces

Protected boundaries currently include Lead, Deal, Quote, Order, Contact, Organization, Customer, Product, Return, Shipping, Support and Task details plus Quote, Order, Return, Shipping and Support mutation forms.

## Backend obligations

The backend must derive workspace and actor from trusted request context, apply typed resource/data-scope/field policies, return explainable reason codes, and audit privileged decisions where required. It must never trust frontend-provided owner, team, role or field-access outcomes.

## Verification

The permanent `quality.effective-record-access` gate verifies the HTTP contract, strict response normalization, fail-closed React boundary, protected surface coverage, command allowlists and field scopes.
