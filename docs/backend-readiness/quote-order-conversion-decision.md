# Accepted Quote to Order decision

Contract version: `0.23.20-contract.0`. Decision `DEC-P06-ACCEPTED-QUOTE-ORDER-CONVERSION` is **CLOSED**.

`convertAcceptedQuoteToOrderDraft` is separate from direct-sale Order creation. It requires an accepted, unexpired and commercially consistent Quote, uses `If-Match`, and enforces one durable Order per Quote under a uniqueness lock. The backend assigns Order identity, number, totals, version and commercial snapshot fingerprint.

Direct-sale Order creation was closed separately by `DEC-P07-DIRECT-ORDER-DRAFT` and is exposed as `createOrderDraftCommand`. It must not be substituted for accepted-Quote conversion.
