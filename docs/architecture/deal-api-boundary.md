# Deal API Boundary — Phase 14

Status: `READY_FOR_BACKEND_CONNECTION` at frontend contract, adapter and connected-runtime level. Live backend acceptance remains external.

## Authority

OpenAPI is the only production contract authority. Deal presentation calls public application commands and authoritative resources; generated clients remain inside `DealHttpApiAdapter`. Connected mode has no browser repository or generic mutation-router fallback.

## Authoritative operations

Queries: `listDeals`, `getDeal`, `getDealForecastSummary`.

Commands: `createDealCommand`, `updateDealCommand`, `changeDealStageCommand`, `assignDealOwner`, `updateDealForecast`, `updateDealNextAction`, `markDealWonCommand`, `markDealLostCommand`, `archiveDealCommand`, `archiveDealsBatch`, `createQuoteForDeal`.

Stage movement is a typed command. Won and Lost require their dedicated outcome operations. Mutable commands use idempotency, and existing aggregate mutations use `If-Match`. Forecast totals are backend-composed decimal-string buckets by currency; the frontend must not add unlike currencies.

## Deliberately blocked

Authoritative import/export jobs and untyped downstream conversion orchestration remain blocked until their owning domains define transaction, document and job semantics. `createQuoteForDeal` is no longer part of this blocked set; it is the typed, ready Deal-to-Quote command declared by OpenAPI. No generic payload is enabled as a substitute.

## Runtime path

```text
Deal presentation
  -> Deal public application boundary
  -> DealApiRuntime
  -> DealHttpApiAdapter
  -> generated CommercialApiClient
  -> platform transport
  -> backend
```

Demo mode uses `createDealDemoApiRuntime`. Compatibility snapshot writes throw `CONNECTED_COMMAND_REQUIRES_ASYNC_AUTHORITY` in connected mode.

## Production acceptance still required

A durable backend must implement all ready Deal operations, enforce workspace and authorization boundaries, persist idempotency and versions, produce forecast projections, pass the live provider pack, and pass browser E2E against a real database.
