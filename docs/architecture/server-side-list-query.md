# Server-side list query runtime

Status: **CURRENT**

Large CRM list surfaces must not fetch every cursor page merely to apply search, filters, sorting and pagination in the browser. Connected mode now uses `useServerPagedModuleCollection` for the table/card surfaces of Lead, Quote and Order.

## Contract

A list request uses the owning module query adapter and sends:

- `limit` and the current backend cursor;
- free-text `search`;
- `sortBy` and `sortDirection`;
- typed `filter.*` query values;
- the workspace header supplied by the shared HTTP client.

The response must return `items`, `pageInfo.hasNextPage`, an opaque `pageInfo.nextCursor` when another page exists, and preferably `pageInfo.totalCount`. The UI keeps a cursor for each visited sequential page, supports previous/next navigation, cancels superseded requests, retains stale data on a transient failure, and resets both cursor state and projected records when workspace, filters, sorting or page size changes.

## Current coverage

- Lead table view: server search/filter/sort and page sizes 25/50/100. Lead Kanban intentionally retains the bounded cursor-complete resource because the board needs all configured stage columns.
- Quote table/card view: server search/filter/sort and cursor pagination.
- Order table/card view: server search/filter/sort and cursor pagination. Order Kanban retains the bounded full projection for the same stage-window reason.
- Deal Kanban uses bounded per-stage windows with independent cursors, loaded/total counts and per-column Load More behavior. See `deal-stage-window-query.md`.

The old `createModuleCollectionResource` remains a transitional, bounded loader for Kanban and cross-record reference surfaces. New large table/list surfaces must prefer server-driven paging.

## Backend obligations

The backend must apply tenant predicates, effective record scope and field projection before counting or returning rows. Cursors are opaque and must be stable for the chosen filter/sort snapshot. `totalCount` must describe the filtered result set, not the unfiltered table. Unsupported filter or sort keys must return a typed validation error rather than being silently ignored.

The permanent `quality.server-side-list-query` gate protects one-request page loading, HTTP query serialization, cursor requirements and Lead/Quote/Order presentation wiring.
