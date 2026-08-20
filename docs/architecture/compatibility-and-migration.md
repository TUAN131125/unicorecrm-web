# Compatibility and Migration

## Principle

Compatibility exists to preserve continuity while current owners replace legacy shapes. It must be narrow, measurable and removable.

Compatibility code does not become a permanent business owner.

## Retired legacy Customer presentation boundary

The former root compatibility presentation directory has been removed. Current Customer list/detail surfaces render from the official Customers module and Customer 360 read models; there is no active runtime compatibility namespace.

Compatibility that remains is owner-local and must be recorded in the retirement ledger. Typical examples are persisted schema readers, deterministic migration correlation fields and deep-link redirects. They do not define a second Customer aggregate or allow new modules/workflows to depend on a legacy Customer DTO.

Reintroduction criteria are intentionally strict: a root compatibility presentation owner must not be recreated. A required transitional adapter belongs beside the canonical owner, must be read-only, must have a ledger entry and must include measurable removal criteria.

## Legacy aliases inside canonical records

Some current records retain compatibility fields such as:

```text
legacyCustomerId
customerId
customerName
```

Their permitted use is limited to:

- display snapshots;
- deep-link continuity;
- deterministic migration correlation.

They must not be used to establish a second Customer record, bypass the Customers module, or replace Contact/Organization identity ownership.

## Migration-only code

Current migration helpers live under:

```text
src/migrations/canonical-v1/
```

They support preview/backfill and issue reporting for legacy data. They are not runtime services.

Architecture rule:

```text
runtime code must not import from src/migrations/
```

Migration helpers may produce deterministic transformed records and review issues, but the resulting runtime state is owned by the target module.

## Deterministic identity and evidence backfills

When legacy data is projected into current owners:

- preserve the source identity reference needed for traceability;
- use deterministic ids where committed seed/backfill stability is required;
- separate imported provenance from delivery terminology;
- keep commercial evidence append-only;
- never infer payment or shipping truth from unrelated legacy fields.

## Persisted browser snapshots

Persisted runtime stores are schema contracts.

A safe migration:

1. reads the existing snapshot;
2. detects its schema version;
3. adds only current missing structure required for compatibility;
4. preserves unrelated user choices;
5. does not silently broaden custom-role permissions;
6. writes the migrated snapshot back atomically under the established key when required.

### Payments transaction snapshot normalization

The current Payments domain uses `allocations[]` as the only allocation authority on a transaction. The former single-obligation pointer and duplicated allocation total are no longer part of the domain or public API.

Persisted browser snapshots created by older frontend builds are normalized at the Payments repository boundary:

- a valid historical single-obligation pointer is converted to one canonical allocation entry;
- duplicated allocation totals are discarded after migration;
- `unappliedAmount` is derived when the persisted snapshot did not provide it;
- repository snapshots returned to runtime consumers contain only the current transaction shape.

This normalization is an upgrade path for browser persistence, not a backend contract. A production backend must expose canonical allocation records and authoritative unapplied balances directly.

## Deletion policy for migration tooling

A migration helper should not be kept only because it once existed.

Before removal, verify:

- no runtime import;
- no barrel export consumed by current tooling;
- no CLI/import path uses it;
- no test protects a still-supported upgrade path.

If the transformation remains supported, name it by the transformation or schema contract. If the upgrade path is no longer supported and has no consumer, remove the code rather than preserving dead tooling under a new name.

## Retirement ledger

The machine-readable retirement authority is `docs/architecture/compatibility-ledger.json`, documented in [Compatibility retirement ledger](./compatibility-ledger.md). It is synchronized with the repository inventory and currently records 53 candidates. No item may be deleted solely to reduce the inventory count.
