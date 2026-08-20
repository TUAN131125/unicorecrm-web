# Support and Tasks contract status

Contract version: `0.23.20-contract.0`.

Core Support and Task contracts are production-ready. Server owns identifiers, numbers, lifecycle, SLA, actor/time/audit evidence and resource versions. Generic `support.update` remains blocked. Synchronous Task snapshot mutations are demo-only and fail closed under connected authority; callers must use the explicit async command wrappers.
