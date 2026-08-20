# Payment Plan and Intent Money Contract

All authoritative amounts use `{ amount: decimal-string, currency: ISO-4217 code }`. JavaScript `number` is presentation/demo-only and may not cross the connected HTTP adapter.

- Backend owns calculation, rounding, schedule-line IDs, resource versions and timestamps.
- Plan preview returns resolved lines and blockers without mutating state.
- Plan draft save, activate and cancel require `If-Match` and idempotency for mutations.
- Intent create accepts buyer, references, Money, method/provider and return route only.
- Intent cancel and retry require authoritative versions; retry returns a new intent ID.
