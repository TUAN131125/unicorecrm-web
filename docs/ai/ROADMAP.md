# Mutation Authority Roadmap

## M0 — Baseline freeze + mutation audit
Status: DONE

## M1 — Workspace/scope-reset authority
Status: DONE

## M2 — Post-commit authoritative projection writes
Status: DONE

## M3 — Server-assigned Task identity
Status: DONE

## M4 — Command dispatch integrity + BLOCKED routed callers
Status: DONE

Note:
financial dedicated module dispatch work is included here.
order-closing dedicated workflow implementation remains a deferred gap.

## M5 — Direct unavailable business ports
Status: DONE

## M6 — WF-01 Contact Opportunity ownership
Status: DONE

Note:
connected WF-01 fails closed on its own declared availability, not on Contact-write
availability. No backend WF-01 operation exists; do not invent one.

## M7 — WF-04 Customer Commercial Actions ownership
Status: DONE

Note:
`deal.create` and `task.create` are both READY, so WF-04 had no incidental protection at
all; connected containment rests entirely on WF-04's own declared availability.

## M8 — WF-21 Work Activation ownership
Status: DONE

Note:
WF-21 is the Deal <-> Task coordination. Single-command activation (an activated AI
suggestion) is deliberately not gated: it is one authoritative command, not a workflow.

## M9 — Partial-commit semantics
Status: DONE

Note:
outcome semantics only. No frontend compensation was added; backend still owns
compensation and any future atomic operation.

## M10 — Central error/unavailable UX
Status: DONE

Note:
presentation only. Stable error codes, internal diagnostics and every M1-M9 preflight are
unchanged; only what the user is shown changed.

## M11 — Full semantic mutation-authority quality gates
Status: DONE

Note:
gate hardening and false-negative elimination. Four gates were proven unable to fail on the
defect they name; each now carries an executable negative control. Four real MA-08
presentation leaks were found and fixed by the hardened scan.

## M12 — Final adversarial full-system audit
Status: DONE — result M12_FINAL_BLOCKED

Note:
the frontend is internally coherent and the full quality suite passes, including repository
inventory. Two release blockers remain and both are external: DF-05 order closing (CMD-046 is
ready, its owning workflow WF-12 is BLOCKED on an unresolved decision) and DF-29 (Contacts,
Customers and Organizations have no production write contract at all). Neither may be closed
from the frontend.

M12 fixed one live invariant violation (DF-10, connected platform configuration written to
browser storage behind authoritative backend reads), gave WF-05/WF-09/WF-12 workflow-owned
refusals (DF-14), added quality.connected-platform-configuration-authority, and repaired two
gate false negatives found by adversarial probing.

A post-M12 blocker-remediation pass (not a new phase) re-derived DF-05 and DF-29 from source,
searched exhaustively for authoritative resolutions and found none, so neither was
implemented. It fixed the one frontend-owned item: the release-artifact gate now runs its rule
against the real archive, and the repository-scoped gate pins the release policy instead of
probing the working tree. All 312 backend-independent gates now pass in their correct execution contexts (the 20 acceptance gates need credentials that do not exist here). The two
release blockers are unchanged and remain externally owned.

## Roadmap policy

The M0–M12 list is CLOSED and now COMPLETE. There is no NEXT phase and no M13.

Do not create additional phase numbers.

Every finding has a final disposition in DEFERRED_FINDINGS.md with an owner and a release
impact. Remaining work is owned by BACKEND, PRODUCT, DATA_MIGRATION or ARCHITECTURE_DECISION —
not by a future roadmap phase.
