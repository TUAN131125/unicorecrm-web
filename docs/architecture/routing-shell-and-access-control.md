# Routing, Shell and Access Control

## Canonical route model

All authenticated product-space routes are workspace-scoped:

```text
/w/{workspaceKey}/crm/...
/w/{workspaceKey}/studio/...
/w/{workspaceKey}/people/...
```

`src/platform/navigation/canonicalRoutes.ts` owns parsing and construction of canonical paths.

A canonical route context contains:

```text
workspaceKey
productSpace
relativePath
```

Legacy unscoped paths are redirected into the appropriate current workspace and product space.

## Product spaces

The application has exactly three product spaces:

### CRM

Daily operational work:

- Dashboard, My Work, Calendar and Notifications;
- Leads, Contacts and Organizations;
- Deals, Quotes and Orders;
- Products;
- Payments, Shipping and Returns;
- Support Cases and Tasks.

### Studio

The current route tree is the canonical workspace configuration area. It contains optional Quick Setup plus ten detailed destinations:

- Quick Setup (always reopenable);
- business information;
- language and region;
- enabled features;
- pipelines and statuses;
- product types;
- information fields;
- payment information;
- invoice information;
- integrations;
- webhooks and API.

Each route is permission-guarded. Quick Setup stores progress metadata only; detailed forms write directly to the owning module. Local development uses clearly labelled browser demo adapters; connected mode creates generated clients and requires backend-owned revisioned contracts. Removed pages are not compatibility routes.

### People & Access

Administrative ownership for:

- members;
- roles and permissions;
- access configuration;
- audit administration.

Studio must not reclaim these surfaces.

## Shell visibility

The shell is contextual to the active product space. CRM navigation is not reused as a universal sidebar.

Visibility combines:

```text
current workspace
+ product space
+ workspace module configuration
+ effective capabilities
+ role-template navigation profile
```

The navigation profile only prioritizes readable modules for the user's responsibility. It never grants capabilities. Custom roles without template provenance fall back to capability-based navigation.

## CRM work navigation

The current CRM shell includes workspace utilities:

```text
Dashboard
My Work
Work Calendar
Notifications
```

The Calendar is a real Task-backed read view at:

```text
/w/{workspaceKey}/crm/calendar
```

It is not a virtual hash anchor and does not create a Calendar aggregate.

Workspace switching and quick actions keep destination paths inside the selected workspace.

## Language consistency

Sidebar, product-space navigation and top bar use one active `vi | en` locale contract.

A product-space or navigation label must not be hard-coded in a way that mixes languages inside the same active shell locale.

## Capability model

Capabilities are declared in `src/platform/access-control/domain/capabilityCatalog.ts`.

Current families include:

```text
dashboard
leads
contacts
organizations
tasks
customer_view
deals
quotes
orders
products
support
reports
payments
returns
shipping
studio
access
audit
```

Examples:

```text
shipping.read
shipping.create
shipping.retry
shipping.cancel
shipping.sync
shipping.manageProviders

returns.read
returns.create
returns.update
returns.approve
returns.resolve
```

The effective access model also includes data scopes and field security.

## Persisted access-control compatibility

The current browser key is schema-migrated rather than replaced blindly.

When a persisted snapshot is older than the current capability catalog:

- canonical system roles receive the capability families intended by the current default role matrix;
- Workspace Owner regains the complete current catalog;
- missing data scopes are restored from current defaults;
- custom roles do not receive new capabilities implicitly;
- assignments, role names, field security and unrelated choices are preserved;
- the migrated snapshot is persisted back under the established key.

This protects users who opened older builds from losing newly available navigation because of stale persisted access data.


## Read-only cross-domain access

Readable modules may be opened without write ownership. `PermissionRouteGuard` exposes `data-access-mode` as `read-only` or `read-write` and renders an explanatory banner when the user can read but cannot perform any module write capability.

`ModuleGuard` consumes the same workspace capability manifest as the router and sidebar. It distinguishes `EXTERNAL`, `HISTORICAL_ONLY`, and `DISABLED` modes instead of collapsing them into one generic disabled screen. These states are explanatory UX only; provider health, fallback authority, and access enforcement remain backend-owned.

Create, edit, qualification, and conversion routes require their specific action capability. A module read capability is not sufficient for a write deep link.

Finance and Operations are first-class default role templates. Schema migration adds the templates without assigning them or expanding custom roles.

## Lazy-route runtime contract

Route modules load through `lazyRouteComponent` and route-local `RouteScreenBoundary` wrappers.

The runtime enforces:

- a 15-second lazy-module timeout;
- expected component export validation;
- route-specific error messages;
- reset when route id/path/search changes;
- recovery to the active product-space home.

A wildcard must redirect or recover explicitly. It must not hide an unknown path by silently rendering Dashboard.

## Hash data-router behavior

The app uses `createHashRouter` with `RouterProvider useTransitions={false}`. The URL remains hash-based while shell blockers receive the Data Router context required by `useBlocker`. Reverting to declarative `HashRouter` breaks authenticated shell startup and is blocked by `quality.authenticated-app-startup`.

## Repository subscription safety

CRM read models often expose defensive snapshot copies. `useRepositorySnapshot` must use the subscription-driven `useSubscribableSnapshot` adapter so React updates only when the repository emits a real change.

Do not replace this with direct `useSyncExternalStore` over snapshot getters that create a fresh array/object on every read.

## Crash recovery

The top-level error boundary provides a demo-session recovery action that clears session, role/permission and active-workspace keys before returning to the HashRouter login route.

Any changes to session or workspace storage keys must keep crash recovery aligned with the active runtime contracts.

## AI boundary

AI remains a CRM-only floating utility:

- no primary AI product-space route;
- no AI sidebar product-space item;
- no fourth Conversations product space;
- the floating utility renders only in CRM when CRM access is available.
