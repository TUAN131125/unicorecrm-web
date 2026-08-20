# Quote API Boundary

Phase 15 establishes Quotes as a dedicated production API boundary.

## Ownership

- Presentation calls Quote application/public commands.
- `QuoteHttpApiAdapter` is the sole generated-client owner for Quote list, detail and lifecycle operations.
- Connected composition binds `createQuoteConnectedApiRuntime`; demo composition binds `createQuoteDemoApiRuntime`.
- Connected mode never falls back to the browser Quote repository for authoritative reads or writes.

## Contract rules

- Draft lines and adjustments use closed DTOs.
- Money is transported as decimal-string `Money`; pricing, tax, discount, rounding and totals are backend authority.
- Aggregate mutations require an idempotency key and existing Quote mutations require `If-Match`.
- Batch approval, expiration and archive carry an expected version per Quote and execute as backend-owned atomic batch commands.
- Mutations return the authoritative Quote, resource version and immutable command evidence.
- Delivery status is recorded only from typed delivery evidence.
- Generic status mutation and the ambiguous generic accept operation remain blocked. Quote acceptance with linked Deal closure continues through the existing typed transaction operation; Order creation remains a separate downstream workflow.

## Remaining blockers

Backend document generation/export jobs, durable provider delivery, live approval authorization, and quote-to-order conversion acceptance require the real backend environment and are not claimed by this frontend contract phase.
