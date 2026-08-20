# Product and commercial evidence ownership

| Concept | Canonical owner | Contract rule |
| --- | --- | --- |
| Product catalog master | Products | Mutable current catalog data; never historical commercial evidence. |
| Price definition | Products/Pricing | Versioned price input; backend validates effective dates and currency. |
| Quote line snapshot | Quotes | Immutable commercial snapshot captured by quote command. |
| Order line snapshot | Orders | Immutable accepted commercial terms; not rehydrated from mutable Product. |
| Invoice line snapshot | Invoices | Immutable legal/financial projection from eligible source lines. |
| Approval evidence | Owning aggregate/workflow | Server-created immutable evidence ID and actor/time. |
| Sequence number | Owning backend module | Server generated; never client generated. |
| Attachment/document | Document/Evidence service | Metadata and access policy are server-owned; aggregate stores references. |
| Product archive/restore | Products | BLOCKED until usage-reference and lifecycle policies are decided. |

Operations that would treat a mutable Product DTO as historical evidence remain blocked. Demo snapshots are allowed only under demo infrastructure and cannot be imported by connected adapters.
