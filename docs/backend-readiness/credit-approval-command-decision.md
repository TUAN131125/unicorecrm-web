# Order credit approval decision

Contract version: `0.23.20-contract.0`. Decision `DEC-P06-ORDER-CREDIT-APPROVAL` is **CLOSED**.

`OrderCreditApproval` is a separate aggregate with states `REQUESTED`, `APPROVED`, `REJECTED`, `REVOKED`, `CONSUMED`, and `SUPERSEDED`. It is bound to the Order and Payment Plan resource versions, typed Money, policy version and evaluation fingerprint. Approved evidence is single-use and consumed atomically by `confirmOrderWithPaymentPlan`.

The frontend sends only an approval ID during confirmation. Actor, decision timestamp, evaluated amount, policy, fingerprint and lifecycle evidence are backend-owned. No wall-clock expiry was invented; any binding change supersedes the evidence.
