# P0.9 Provider Conformance and Query Authority Closure

Contract version: `0.23.20-contract.0`. Input SHA-256: `fb504d1d15e57f2eca987d42268d682a2af944263bd7ed054b251580955d3ee8`.

## Closed decisions

- **Reference provider conformance:** a dependency-free, non-production host executes all 166 scenarios through actual OpenAPI methods, paths and schemas. Production composition cannot import it.
- **Connected fixture migration:** generated `listLeads`, `getLead` and `createLead` replace retired generic Lead success assumptions; blocked generic query/mutation authority is asserted fail-closed.
- **Lead/Product reads:** explicit OpenAPI list/detail projections are ready. Generic module-query exposure stays fail-closed until typed application DTO adapters preserve canonical decimal-string Money and application semantics.
- **Shipping/Return reads:** explicit workspace-scoped OpenAPI list/detail projections are ready with closed DTOs and server-owned `resourceVersion`; application adapter ownership remains separate.

## External blocker

`DEC-P09-LIVE-PROVIDER-CONFORMANCE` remains **BLOCKED_EXTERNAL**. Reference-host success does not prove durable persistence, real transaction isolation, production identity, provider transport or database-enforced workspace isolation.
