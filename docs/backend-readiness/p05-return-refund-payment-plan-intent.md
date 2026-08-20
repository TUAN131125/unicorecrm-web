# Backend Contract Hardening P0.5

Contract version: `0.23.20-contract.0`.

## Payment Plan and Payment Intent

Production Payment Plan, Schedule Line and Payment Intent projections use canonical decimal-string `Money`. `resourceVersion` is server-owned and is the only valid concurrency token.

Payment Plan preview is a read-only server calculation. Draft save, activation and cancellation require `If-Match`; the client sends agreement intent and cancellation reason only. Payment Intent creation excludes client-generated IDs, checkout URLs, expiry, lifecycle state, timestamps and provider evidence. Cancel and retry require `If-Match`; retry creates a new server-assigned intent.

## Return credit/refund

`resolveReturnCreditRefund` starts a backend-owned saga and returns `202 Accepted`. Credit Notes, allocation reversals, Refund Intents, audit evidence and terminal Return resolution are recorded by backend services. The frontend may poll `getReturnCreditRefundResolution` but may not coordinate repositories, roll back production state or present a locally created refund as completed.

The local snapshot workflow remains explicitly demo-only. Refund cancellation requests and retry are now typed, ready operations under the P0.8 recovery contract. Generic Customer Credit allocation and the Customer Credit variant of Return resolution remain fail-closed until the residual-allocation policy is approved.
