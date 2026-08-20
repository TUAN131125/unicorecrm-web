# Type Safety and Strictness

## Purpose

TypeScript strictness is a repository contract, not a one-time cleanup. The source tree is compiled with `strict: true`, while boundary code that exchanges authoritative data receives additional checks for omitted properties and indexed access.

The goals are:

- reject implicit `any` across application source and quality tooling;
- require explicit handling of nullable and optional data;
- keep API, mutation, money and order-to-cash contracts free of unsafe assertions;
- prevent new type suppressions from accumulating in protected boundaries;
- ratchet legacy `any`, `as any` and non-null assertions downward instead of allowing regression.

## Global strict compilation

`tsconfig.json` enables:

```json
{
  "strict": true,
  "useUnknownInCatchVariables": true
}
```

The primary gate is:

```bash
npm run lint
```

This compiles the complete TypeScript project, including source and repository quality scripts. Runtime, presentation and tooling code must therefore handle implicit `any`, nullability and unknown errors explicitly.

## Protected boundary regions

`tsconfig.strict-core.json` applies additional compiler guarantees to:

```text
src/shared/application
src/shared/domain
src/platform/api
src/shared/money
src/shared/order-to-cash
```

These regions enable:

```json
{
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

The distinction is important at backend-facing boundaries:

- an omitted property is not equivalent to a property explicitly set to `undefined`;
- indexed reads may be absent and require a guard or fallback;
- mutation and HTTP metadata must only include optional fields when values exist;
- server error envelopes and authoritative-resource snapshots must preserve exact payload meaning.

Run:

```bash
npm run quality:gate -- --gate quality.strict-core
```

## Unsafe construct policy

Protected boundary regions must contain zero:

- explicit `any` keywords;
- `as any` assertions;
- non-null assertions;
- `@ts-ignore` or `@ts-expect-error` suppressions.

The permanent guard is:

```bash
npm run quality:gate -- --gate quality.strict-type-regions
```

Outside protected boundaries, existing unsafe constructs are controlled by a ratchet budget. The budget may decrease but must not increase. New code should use `unknown`, validation, discriminated unions, typed adapters and explicit fallback logic instead of unsafe assertions.

## Optional-value rules

Use conditional object construction when an optional field has no value:

```ts
const payload = {
  command,
  ...(actor === undefined ? {} : { actor }),
};
```

Do not emit `{ actor: undefined }` into backend-facing contracts.

For legacy records, normalize optional values at the boundary where they become required:

```ts
const unitPrice = line.unitPrice ?? line.unitPriceSnapshot ?? 0;
```

The fallback must reflect existing business behavior. Type fixes must not invent business state or silently change lifecycle rules.

## Catch and external payload handling

Catch variables remain `unknown`. External values must be narrowed before access:

```ts
catch (error: unknown) {
  if (error instanceof ApiClientError) {
    // typed handling
  }
}
```

HTTP responses, persisted snapshots and provider payloads are never cast directly into domain entities without validation or normalization.

## Migration order for future hardening

Further compiler hardening should continue in this order:

1. shared API and mutation contracts;
2. module application ports;
3. module domain rules;
4. HTTP/provider adapters and mappers;
5. controller hooks and presentation models;
6. remaining presentation and compatibility code.

Options such as `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` should be expanded only after the next region compiles cleanly and its behavior is protected by focused tests.
