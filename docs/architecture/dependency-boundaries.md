# Dependency Boundaries

## Purpose

The frontend uses explicit dependency direction so browser-backed adapters can later be replaced by backend HTTP adapters without rewriting presentation code.

```text
presentation
    ↓
public/application boundary
    ↓
application
    ↓
domain

runtime/composition ── wires ──> infrastructure implementations
```

## Layer responsibilities

### Domain

Domain code owns entities, value objects, policies, and pure business rules. It must not import React, browser APIs, runtime composition, storage, HTTP, presentation, or infrastructure implementations.

### Application

Application code owns commands, queries, ports, and orchestration contracts. It may depend on domain code and approved shared primitives, but not on React, presentation, runtime composition, or concrete adapters.

### Presentation

Presentation code renders UI and invokes module public/application operations. It must not import concrete repositories, browser stores, HTTP adapters, or module runtime wiring.

### Infrastructure

Infrastructure code implements persistence, HTTP, browser storage, export, provider, and other adapter concerns. Infrastructure may implement application ports and map external data into application or domain contracts.

### Runtime and composition

`runtime/` is a module-local wiring boundary. It owns concrete browser-backed adapter instances and integration wiring that previously lived under `infrastructure/` and was imported by UI code. Runtime files are not domain or application APIs.

Presentation, domain, and application code must not import `runtime/`. Module public operations may temporarily delegate to module-local runtime while the application-port and application-composition work is completed. The next architecture step replaces this temporary delegation with injected application ports selected by the application composition root.

## Public boundary rules

- `src/modules/<module>/public/index.ts` is the canonical cross-module barrel. The module root `index.ts` exports only that barrel and the module manifest.
- HTTP adapters and browser repositories are imported only by composition/runtime code or adapter-specific tests.
- Presentation uses named business operations such as snapshots, commands, subscriptions, preferences, or exports rather than receiving repository objects.
- Cross-module consumers import module roots or workflow roots, never another owner's implementation directory.
- Module code never imports `src/app/`; route identity and application-state React contracts are owned by `src/platform/navigation` and `src/platform/application-state`.

## Enforced invariants

`npm run quality:gate -- --gate quality.architecture` rejects:

- domain imports from infrastructure or runtime;
- application imports from presentation, infrastructure, or runtime;
- presentation imports from infrastructure or runtime;
- module public/root boundaries importing infrastructure directly;
- module imports that point upward into `src/app/`;
- missing module `public/index.ts`, non-minimal module roots, or workflows without stable root entries;
- workflow presentation/application imports from infrastructure or runtime;
- workspace presentation imports from infrastructure or runtime.

The repository cleanup manifest protects the old runtime paths so wiring cannot silently move back into `infrastructure/`.

## Current transition state

The browser-backed demo runtime is intentionally preserved to avoid changing accepted product behavior before connected backend mode exists. Module-local `runtime/` is therefore a transitional composition seam, not the final backend-ready application composition root.

The canonical `src/platform/api` foundation and operation catalog are now established. The following step is to migrate one module at a time from transitional shared executors to module-owned query/command ports and HTTP adapters selected by the application composition root.
