# Inference register

Status: NON_AUTHORITATIVE.

| ID | Classification | Inference | Treatment |
|---|---|---|---|
| INF-001 | CORROBORATED | Server uses one tenant boundary per workspace across all operations. | Canonical MUST, supported by bootstrap/access/OpenAPI metadata. |
| INF-002 | INFERRED | Workflow-local transactions should be atomic; external providers require durable saga recovery. | Canonical pattern only where source/contract delivery metadata supports it; missing mappings remain gaps. |
| INF-003 | NON_BLOCKING_DESIGN_DEBT | Per-currency minor-unit rules. | Not declared by OpenAPI and not inferred from `DecimalAmount.x-maximum-scale: 6`; `Money.x-rounding-mode: HALF_UP` remains authoritative and distinct. |
| INF-004 | DECISION_REQUIRED | Commercial Evidence production list/detail transport. | Kept blocked as a query coverage gap. |
| INF-005 | PROPOSED | Number-based commercial compatibility fields should migrate to MoneyDto. | Non-blocking frontend compatibility work; ProductDocument numeric money fields are contractually display-only/non-authoritative and historical snapshots are not silently rewritten. |
