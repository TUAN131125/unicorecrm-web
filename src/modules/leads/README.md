# Leads module

Lead List, Queue, and Detail are owned by this vertical module. Runtime state uses the canonical split between `leadWorkState` and `qualificationOutcome`.

The old arbitrary Lead Conversion workflow is retired. Cross-module qualification paths live under `workflows/lead-qualification`:

- DISQUALIFIED -> Lead command with reason/evidence;
- NURTURE -> relationship resolution + CareItem;
- OPPORTUNITY -> relationship resolution + successful Deal creation;
- DIRECT_SALE -> relationship resolution + Quote or Order, without a hidden Deal.

State ownership remains in `LeadRepository`. Acquisition routing enters through the explicit `workflows/acquisition-routing` boundary.

## Identity governance

Possible duplicates are human-review candidates. `lead.merge-duplicates` archives and links source Leads instead of deleting them, preserves source lineage and consent evidence, and rejects clusters with conflicting canonical relationships. `lead.confirm-duplicates-distinct` records a durable pairwise exclusion. Communication permissions are derived from an append-only consent ledger; `doNotCall`, `doNotEmail`, `doNotSms`, and `doNotZalo` are compatibility projections.

## Production API boundary

Lead list, detail and typed create transport are owned by `application/ports/LeadApiRuntime.ts` and `infrastructure/http/LeadHttpApiAdapter.ts`. Connected list/detail screens no longer call the generic module data authority. Generated `CommercialApiClient` types stop at the infrastructure mapper boundary.

Lead profile create/edit and the single-aggregate lifecycle commands `advanceLeadWorkState`, `disqualifyLead`, and `reopenDisqualifiedLead` now use dedicated, closed production contracts with idempotency, `If-Match`, and authoritative mutation evidence. Connected UI paths do not fall back to browser authority. Positive qualification, duplicate resolution, consent, archive/anonymize, and bulk lifecycle workflows remain explicitly contract-blocked or demo-only. See `docs/architecture/lead-api-boundary.md` and `docs/backend-readiness/lead-lifecycle-qualification-decision.md`.

