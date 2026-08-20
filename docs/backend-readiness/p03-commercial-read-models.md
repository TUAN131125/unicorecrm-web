# P0.3 authoritative commercial read models

Contract version: `0.23.20-contract.0`. Decision: `DEC-P03-COMMERCIAL-READ-MODELS` — **CLOSED**.

Deal, Quote and Order now expose explicit list and detail projections. Each projection carries backend-authored `resourceVersion`; Quote business revision remains a separate `quoteRevision`. Money remains decimal-string `Money` in HTTP and is converted to legacy JavaScript numbers only inside named compatibility projection functions.

Connected lifecycle commands must receive `expectedVersion` from these projections. Browser repository timestamps, Quote revision numbers and configured pipeline versions are not concurrency tokens.
