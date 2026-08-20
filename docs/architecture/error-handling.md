# Error taxonomy and UI handling

Unicore CRM uses machine-readable error codes and categories across application commands, HTTP adapters, authoritative resources, and presentation. UI control flow must never depend on diagnostic message text.

## Canonical error model

`ApplicationError` is the shared error boundary. It carries:

- stable `code`;
- category: validation, authentication, authorization, not found, conflict, business rule, rate limit, timeout, cancellation, network, integration, infrastructure, or unknown;
- field errors and business blockers;
- request/correlation identifiers;
- retryability;
- optional structured `details`;
- optional operator-safe `userMessage` separate from the diagnostic `message`.

`ApiClientError` and `MutationCommandError` extend this model. HTTP error envelopes may return `userMessage`; raw server diagnostics are retained for observability but are not rendered to operators.

## UI behavior

`presentApplicationError()` maps categories to a safe message, display surface, and recovery action:

- validation → field feedback;
- authentication → sign in;
- authorization/not found → protected inline or page state;
- conflict → refresh authoritative data;
- business rule → inline blocker;
- timeout/network/rate limit/integration/infrastructure → retry;
- cancellation → silent state;
- unknown → safe generic message with correlation evidence.

Presentation uses `formatApplicationError()` rather than `Error.message` or `String(error)`.

## Structured domain failures

Details must be carried in `details`, never encoded into message strings. Examples:

- `DEAL_NOT_WON` carries `dealId` and `dealName`;
- `CREDIT_APPROVAL_REQUIRED` carries amount, currency, and approver role;
- `CSV_EMPTY` is a validation code.

## Guard

`npm run quality:gate -- --gate quality.error-handling` protects taxonomy mapping, safe server-message behavior, mutation classification, authoritative resource normalization, structured failure details, and all presentation files against message-based control flow or raw error rendering.
