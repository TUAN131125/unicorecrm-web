# Lead Identity Governance

## Scope

P1 begins by making Lead identity review explicit and durable. Possible duplicates are candidates for human review, not deletion instructions.

## Duplicate decisions

- Detection uses normalized email and phone signals.
- A reviewer may confirm records are distinct; the pair is excluded from future duplicate queues while the decision and reason remain on both records.
- A reviewer may merge a connected identity cluster into one survivor.
- Source Leads are archived, linked through `mergedIntoLeadId`, and retain their original payload and activity history.
- The survivor receives source lineage, tags, interested products, activities, consent evidence and `mergedLeadIds`.
- Records with conflicting canonical `relationshipRef` values cannot be merged.
- Connected Mode executes merge and distinct decisions through the `lead-identity-resolution` workflow authority.

## Consent ledger

Communication consent is append-only evidence per channel (`CALL`, `EMAIL`, `SMS`, `ZALO`). The current decision is derived from the latest ledger entry. Compatibility flags such as `doNotEmail` are projections, not the source of truth.

## Backend obligations

The backend must enforce workspace scope, capability, record scope, expected versions for every member of a merge cluster, relationship conflicts, append-only audit evidence, and idempotent workflow execution. It must never hard-delete source Lead records during merge.
