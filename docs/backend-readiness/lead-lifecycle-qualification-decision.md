# Lead qualification workflow contract decision

Contract version: `0.23.20-contract.0`

## Closed production operations

- `qualifyLeadForNurture`: relationship, optional follow-up task and Lead closure are one backend-owned workflow.
- `qualifyLeadForOpportunity`: relationship, Deal, optional follow-up task and Lead closure are one backend-owned workflow.
- `qualifyLeadForDirectSale`: relationship, Quote or Order and Lead closure are one backend-owned workflow.

All three require `Idempotency-Key` and `If-Match`, use closed DTOs, and return authoritative workflow evidence. Direct Sale sends decimal-string Money inputs only; totals, tax, rounding, document numbers and downstream IDs are backend-owned.

The generic `qualifyLead` operation is deprecated and blocked without a success response. The browser workflow remains demo-only and is never a connected transaction coordinator.
