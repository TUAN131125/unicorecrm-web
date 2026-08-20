# Product module pilot

This is the first migrated vertical module.

## Ownership

- `domain/`: Product model and deterministic rules.
- `application/`: commands, queries, usage queries, import/export parsing, and ports.
- `infrastructure/`: local repository, browser exporter, mock seed, and temporary runtime wiring.
- `presentation/`: React pages, components, and screen hooks.
- `public/`: stable catalog read/subscription API used outside the module.
- `manifest.ts`: module registration metadata.

## Compatibility

Legacy files under `src/features/products/` re-export the migrated implementation so existing modules can move gradually.

New code should not add business logic to those compatibility files.
