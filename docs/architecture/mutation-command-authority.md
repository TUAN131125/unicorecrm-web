# Mutation command authority and state transitions

## Purpose

Business lifecycle changes are commands owned by a module or an explicit cross-module workflow. React presentation may request a transition and display its result, but it does not decide whether the transition is authoritative, write multiple aggregates directly, manufacture audit success, or treat a toast/local snapshot as durable completion.

The canonical flow is:

```text
presentation action
  -> module/workflow command boundary
  -> MutationAuthorityPort
      -> LocalMutationAuthority in demo mode
      -> HttpMutationAuthority in connected mode
  -> authoritative MutationOutcome
  -> query/read-model refresh where applicable
```

## Command contract

`src/shared/application/mutation/mutationAuthority.ts` defines the backend-facing command envelope and result.

A command identifies:

- `commandType`;
- aggregate type and identifier;
- typed payload;
- actor context when available.

Command metadata carries:

- a stable `idempotencyKey`;
- `expectedVersion` for versioned aggregates;
- `correlationId`;
- cancellation signal;
- actor evidence.

A successful command returns `MutationOutcome<T>` with:

- authoritative data;
- command and correlation identifiers;
- occurred-at time;
- resulting version when available;
- emitted-event names;
- audit authority and evidence identifiers.

Presentation awaits this outcome. It does not infer success from a local mutation or continue a dependent workflow after a failed/conflicted command.

## Runtime authority

### Demo mode

`LocalMutationAuthority` preserves the approved browser-backed behavior while enforcing the same command contract. It deduplicates identical commands by idempotency key, rejects reuse of one key for a different command, exposes synthetic completion-event evidence, and returns a versioned outcome.

Local handlers may use module runtime snapshots only behind a command or workflow boundary. For workflows that touch multiple owners, demo handlers restore prior snapshots when a later step fails so the browser simulation does not leave a partial transaction.

### Connected mode

`HttpMutationAuthority` sends the complete command envelope through the shared `HttpClient`. Connected commands require authentication and workspace context and carry idempotency, expected-version and correlation metadata. The backend validates authorization, invariants, concurrency and transaction boundaries; it owns the authoritative audit/event result.

Connected mode is fail-closed. It does not silently execute the browser handler when the backend path is unavailable.


## Connected trust boundary

`HttpMutationAuthority` sends only the typed command envelope plus transport metadata (`Idempotency-Key`, `If-Match`, correlation, authentication and workspace headers). Frontend-provided actor and requested timestamps are retained only for demo/local evidence and are not sent as authoritative connected command fields. The backend derives actor, workspace and accepted time from authenticated server context.

## Lifecycle coverage

Command boundaries protect the current lifecycle owners:

- Lead work-state, verification, qualification, disqualification and reopen;
- Deal stage transitions, WON/LOST close and recycle;
- Quote status and approval transitions;
- atomic Quote acceptance with Deal closing;
- Order confirmation, cancellation and fulfillment closing;
- Invoice create/save/issue/send/credit/void;
- Payment recording, intent, allocation, reversal, refund and reconciliation;
- Shipping booking, cancellation, synchronization, retry and provider change;
- Return approval, rejection, receipt, pickup, replacement/exchange, credit/refund, repair, resolution and close;
- Support case transitions.

Single-owner transitions stay in the owning module. Multi-owner effects live in named workflows. Presentation must never reproduce those transaction sequences.

## Compatibility rule

Synchronous snapshot functions may remain temporarily for demo runtime handlers, migration tooling and focused tests. They are not presentation APIs. New presentation code must use command boundaries, and new connected implementations must implement command/application ports rather than expose repositories.

## Error and conflict behavior

`MutationCommandError` and shared API errors map to typed mutation states. Version or business conflicts stop the current sequence and preserve correlation/blocker evidence. UI surfaces may request an authoritative refresh before retrying; they must not overwrite a newer version.

## Verification

```bash
npm run quality:gate -- --gate quality.mutation-command-authority
```

The gate exercises local idempotency and key-reuse rejection, validates HTTP command metadata, protects lifecycle/workflow coverage, verifies demo transaction rollback evidence, rejects legacy lifecycle calls in presentation and rejects presentation-owned storage or transport mutations.
