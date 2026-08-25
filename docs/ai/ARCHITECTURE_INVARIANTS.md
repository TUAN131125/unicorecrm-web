# Architecture Invariants

Stable rules. They outlived the M0–M12 roadmap and remain the standing contract.
Change only with explicit user direction.

## Production connected mutation path

```text
Presentation
→ typed application command/workflow
→ authoritative owner
→ backend authority
→ permission / version / idempotency
→ transaction / workflow
→ authoritative evidence
→ invalidate / refetch / backend projection
→ UI
```

## MA-01 — Backend authority

Connected business mutations must be backend-authoritative.

Forbidden: backend READ + frontend local WRITE presented as production
authority.

## MA-02 — BLOCKED containment

Canonical BLOCKED commands must not be reachable as connected production
mutations.

## MA-03 — Identity authority

Client intent/dedupe IDs must not be persisted as aggregate foreign refs where
the aggregate ID is server-assigned.

## MA-04 — No post-commit local projection

After a backend commit, presentation code must not mutate the authoritative
business projection/repository to simulate the result.

## MA-05 — Scope-reset authority

Workspace/scope projection eviction is infrastructure-owned and must not be
treated as a business mutation.

## MA-06 — Workflow ownership

If `connectedFrontendCoordinatorAllowed = false`, the connected frontend must
not coordinate the workflow by sequencing module commands.

Individually authoritative commands do not make frontend workflow coordination
authoritative.

## MA-07 — Partial commit

If multiple authoritative mutations can partially succeed, committed results
must not be discarded or represented as total failure.

Closed in M9. Outcome semantics only: no frontend compensation exists anywhere,
and none may be added. Compensation is backend-owned.

## MA-08 — Safe architecture errors

Internal topology/authority errors must not leak directly to user-facing UI.

Closed in M10. Stable error codes, internal `message` and structured `details`
are unchanged; only what the user is shown changed.

## MA-09 — Connected unavailable business ports

Connected UI must not call business mutations whose connected binding is
unavailable, demo, or local-only. Use an authoritative backend command if one
exists; otherwise fail closed.

## Dedicated command rule

```text
READY + DEDICATED_MODULE_HTTP_ADAPTER   → dedicated module adapter
READY + DEDICATED_WORKFLOW_HTTP_ADAPTER → dedicated workflow adapter
```

Never route these through the generic `RoutedHttpMutationAuthority`.

Dedicated commands do not belong in `PRODUCTION_COMMAND_CONTRACTS`.

## Demo rule

Demo/local authority may use local repositories only when the surface is
explicitly demo-owned. Never use a demo/local fallback as connected production
authority.
