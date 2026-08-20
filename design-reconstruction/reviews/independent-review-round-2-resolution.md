# Independent review round 2 - implementer resolution

Status: NON_AUTHORITATIVE REVIEW EVIDENCE. Canonical status remains `RECONSTRUCTED_DRAFT`.

## Scope

Only R2-01 was resolved. No backend, baseline, `BASELINE.json`, `src/` file or existing `docs/` file was created or modified. R2-02, deferred blocked operations/commands, live-provider conformance, F-HIGH-INVENTORY and F-HIGH-DOCUMENT-STATUS were not resolved.

## R2-01 evidence and disposition

Authoritative source: `docs/api/openapi.json`, SHA-256 `8278547df0fd4be9a9af9b8a6d5f3e15ddad8d005d804c99a7c9248e0f402757`.

| JSON Pointer | Verified contract value | Resolution |
|---|---|---|
| `#/components/schemas/Money/x-rounding-mode` | `HALF_UP` | Surfaced unchanged in canonical money and contract design. |
| `#/components/schemas/Money/x-currency-owner` | `WORKSPACE_CONFIGURATION` | Surfaced unchanged; workspace configuration remains currency owner. |
| `#/components/schemas/Money/x-negative-policy` | `OPERATION_SPECIFIC` | Surfaced unchanged; no blanket negative policy invented. |
| `#/components/schemas/DecimalAmount/x-maximum-scale` | `6` | Surfaced unchanged as maximum decimal scale, explicitly not a currency minor-unit rule. |
| `#/components/schemas/ProductDocument/x-money-semantics` | `unitPrice and costPrice are authoritative decimal-string Money. Numeric frontend fields are display-only projections.` | Surfaced as the contract rule that numeric frontend money fields are display-only and non-authoritative. |

A case-insensitive whole-contract search for minor-unit terminology returned zero matches. Per-currency minor units are therefore undeclared and remain `NON_BLOCKING_DESIGN_DEBT`; no per-currency rule was invented. Maximum decimal scale and currency minor units remain explicitly distinct.

Disposition: **R2-01 RESOLVED**. Remaining `DESIGN_BLOCKER`: **0**. Remaining `DESIGN_HIGH`: **0**. The two repository-governance issues retain their non-design classification.

Final canonical status: **RECONSTRUCTED_DRAFT**.
