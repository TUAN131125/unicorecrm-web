# Return Credit/Refund Saga

`resolveReturnCreditRefund` is `BACKEND_ORCHESTRATED_SAGA`.

1. Validate Return is received and inspected, amount/currency, issued Invoice ownership and effective Payment allocation evidence.
2. Persist saga acceptance and idempotency fingerprint.
3. Issue Credit Notes and reverse applicable allocations through module-owned commands.
4. Create asynchronous Refund Intents for cash effects.
5. Keep Return unresolved while refund evidence is pending.
6. Mark completed only after canonical evidence is complete; otherwise persist `FAILED` or `MANUAL_REVIEW_REQUIRED`.

Connected frontend compensation, repository snapshots and synthetic refund completion are prohibited. Refund retry/cancel and Customer Credit treatment remain separate blocked decisions.
