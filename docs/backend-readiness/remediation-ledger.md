# Remediation Ledger

Current contract: `0.23.20-contract.0`. Original audit source SHA-256: `655a4d9b2e547c92cfaaf62bfd5c4ccf637a4b8271eb703e13211538728f5b8c`.

- Commands: 173 total; 152 ready; 17 blocked; 4 deprecated.
- Queries: 162 total; 0 unresolved.
- OpenAPI: 276 operations; 245 ready; 31 blocked.
- Provider conformance: 26 packs; 516 scenarios defined; the Shipping/Returns live pack is `BLOCKED_EXTERNAL`.
- Quality pipeline: 310 deterministic gates across 11 groups.

| Finding | Severity | Reproduction | Remediation | Owner | Remaining risk |
| --- | --- | --- | --- | --- | --- |
| H-01 | High | CONFIRMED | CLOSED | API Contract Architecture | None for P0; blocked mutations still need module decisions before implementation. |
| H-02 | High | CONFIRMED | PARTIALLY_CLOSED | Module Domain Owners + API Contract Architect | 17 blocked commands and 4 deprecated commands require module-owned DTO, invariant and workflow decisions before production implementation. |
| H-03 | High | CONFIRMED | PARTIALLY_CLOSED | Module Domain Owners + Read Model Architect | All 162 query symbols are classified; no generic route inference exists. |
| H-04 | High | CONFIRMED | CLOSED | Module/Platform Owner | Positive close/reopen/archive operations remain blocked until evidence and transaction semantics are approved. |
| H-05 | High | CONFIRMED | CLOSED | Module/Platform Owner | Backend provider tests remain unavailable until a backend exists. |
| H-06 | High | CONFIRMED | CLOSED | Module/Platform Owner | Resource predicates and live cross-workspace enforcement still require backend provider execution. |
| H-07 | High | CONFIRMED | CLOSED | Support Backend Owner + Work Management Backend Owner + API Contract Architect | Live provider execution remains BLOCKED_EXTERNAL; generic support.update stays blocked. |
| H-08 | High | CONFIRMED | CLOSED | Module/Platform Owner | Backend transaction/saga implementation and durable compensation tests are future work. |
| H-09 | High | CONFIRMED | CLOSED | Module/Platform Owner | Legacy Partial<T>/browser repositories remain demo-only and must never be reused as backend DTOs. |
| H-10 | High | CONFIRMED | BLOCKED_EXTERNAL | Backend Implementation Team + CI/Environment Owner | Reference conformance does not prove durable production backend behavior; external provider execution remains blocked. |
| H-11 | High | CONFIRMED | CLOSED | Module/Platform Owner | Backend persistence/retention/replay behavior must be tested during implementation. |
| H-12 | High | CONFIRMED | CLOSED | Module/Platform Owner | Global tax precision and allocation residual policy remain unresolved outside the Invoice vertical slice. |
| M-01 | Medium | CONFIRMED | CLOSED | API Contract Architecture | Module-specific error expansion may be needed as blocked operations are specified. |
| M-02 | Medium | CONFIRMED | OPEN_P1 | API Contract Architecture | Raw/legacy UI message rendering still needs a presentation audit before integration. |
| M-03 | Medium | CONFIRMED | CLOSED | API Contract Architecture | Missing projection/filter decisions remain represented as blockers. |
| M-04 | Medium | CONFIRMED | CLOSED | Module/Platform Owner | Future additive enum changes require explicit extension-point policy or coordinated client update. |
| M-05 | Medium | CONFIRMED | CLOSED | API Contract Architecture | Operational enforcement of Sunset/Deprecation headers is backend P2. |
| M-06 | Medium | CONFIRMED | PARTIALLY_CLOSED | Module/Platform Owner | Demo/browser code still creates local IDs/timestamps by design; architecture guard must keep it isolated. |
| M-07 | Medium | CONFIRMED | CLOSED | Module/Platform Owner | Live provider/runtime coverage remains separate and BLOCKED_EXTERNAL. |
| M-08 | Medium | CONFIRMED | CLOSED | Module/Platform Owner | 34 commands are intentionally blocked pending semantic decisions. |
| M-09 | Medium | CONFIRMED | BLOCKED | Support Backend Owner | Support backend owner must define atomic sequence and calendar/SLA behavior. |
| M-10 | Medium | CONFIRMED | BLOCKED | Configuration Domain Owners | Configuration-specific DTOs require configuration domain owners. |
| M-11 | Medium | CONFIRMED | BLOCKED_EXTERNAL | Backend Implementation Team + CI/Environment Owner | Static syntax and P0 deterministic gates do not replace full compilation/E2E. |
| M-12 | Medium | CONFIRMED | CLOSED | API Contract Architecture | Rate-limit and production observability behavior still needs backend provider tests. |
| L-01 | Low | CONFIRMED | CLOSED | Module/Platform Owner | None. |
| L-02 | Low | CONFIRMED | OPEN_P3 | Module/Platform Owner | Layer placement can be improved later. |
| L-03 | Low | CONFIRMED | CLOSED | Module/Platform Owner | Teams must continue enforcing naming/architecture guards. |
| L-04 | Low | CONFIRMED | CLOSED | API Contract Architecture | Frontend ApplicationError details remain internal compatibility data and should not be displayed raw. |

## Phase history

| Phase | Contract | Scope | Result |
| --- | --- | --- | --- |
| P0.9 | 0.23.1-contract.0 | Reference provider conformance, connected Lead fixture migration and Lead/Product/Shipping/Return read authority closure | READY_WITH_BLOCKERS |
| P0.10 | 0.23.1-contract.0 | Process-isolated provider conformance, application DTO adapter closure and complete query registry decisions | READY_WITH_BLOCKERS |
| Phase 16 | 0.23.16-contract.0 | Product and Order dedicated API boundaries, provider pack and connected-mode cutover | READY_WITH_BLOCKERS |

| Phase 17 | 0.23.17-contract.0 | Invoice, Receivables and Payments dedicated API boundaries, financial provider pack and connected-mode cutover | READY_WITH_BLOCKERS |
| Phase 18 | 0.23.18-contract.0 | Shipping and Returns dedicated API boundaries, backend-owned cross-module workflows and provider pack | READY_WITH_BLOCKERS |
| Authority reconciliation | 0.23.19-contract.0 | Canonical authority order, Quote-to-Order semantics, decision ledger, Shipping/Returns errors and breaking baseline synchronization | READY_WITH_BLOCKERS |
| Quality baseline remediation | 0.23.20-contract.0 | Type safety, architecture, bundle budget, Orders query projection, demo access bootstrap, runtime cleanup and route smoke coverage | READY_WITH_EXTERNAL_ACCEPTANCE_BLOCKERS |
