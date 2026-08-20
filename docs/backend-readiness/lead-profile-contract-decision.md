# Lead profile contract decision

Contract version: `0.23.20-contract.0`.

## Decision

- `CreateLeadRequest.customerId` is removed. A Lead may exist before a canonical Customer relationship is established.
- `createLead` owns profile creation only. The backend assigns ID, lifecycle state, score, timestamps, resource version, audit evidence and interested-product read-model identifiers.
- Editable profile changes use `replaceLeadProfile` (`PUT /leads/{leadId}`), not a generic status or aggregate patch.
- Replacement requires `Idempotency-Key` and `If-Match`; stale versions return a typed conflict.
- Omitted optional profile fields are cleared. Lifecycle, qualification, identity resolution and score are outside the operation.
- Typed custom-field value records replace open `Record<string, unknown>` transport payloads.
- `lead.create` and `lead.update` are owned by `LeadHttpApiAdapter`, not the generic routed mutation authority.

## Evidence

- OpenAPI: `docs/api/openapi.json`
- Application port: `src/modules/leads/application/ports/LeadApiRuntime.ts`
- Adapter: `src/modules/leads/infrastructure/http/LeadHttpCommandAdapter.ts`
- Mapper: `src/modules/leads/infrastructure/http/LeadApiMapper.ts`
- Runtime integration fixture: `tests/quality/integration/check-connected-backend-integration.mts`
- Architecture guard: `tests/quality/architecture/check-lead-api-boundary.mts`

## Lifecycle boundary

This profile decision does not authorize lifecycle inference. Disqualification, archive, reopen, consent and duplicate-resolution now use their typed ready operations. The generic `qualifyLead` operation is intentionally retired and remains blocked; callers use `qualifyLeadForNurture`, `qualifyLeadForOpportunity` or `qualifyLeadForDirectSale`. No standalone Lead verification operation is declared by the current OpenAPI contract.
