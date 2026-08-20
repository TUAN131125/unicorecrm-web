# ADR-003: Money, currency and rounding

> **Status:** ACCEPTED FOR BACKEND DESIGN  
> **Date:** 2026-07-17  
> **Decision scope:** Financial and commercial contracts

## Context

The frontend already has `MoneyDto` and decimal-string utilities, while several legacy commercial models still contain JavaScript `number` amounts. Floating-point values cannot become canonical backend financial contracts.

## Decision

1. Canonical API money uses `MoneyDto` with `amount` as a base-10 decimal string and `currency` as an uppercase ISO 4217 code.
2. Backend persistence uses fixed-precision decimal/numeric types. Binary floating point is prohibited for prices, tax, discounts, allocations, credits, receivables and settlement values.
3. Currency scale, rounding mode and tax rounding stage are explicit policy. Defaults cannot be inferred from browser locale.
4. Calculations preserve intermediate precision and round only at the policy-defined boundary. Line, document and allocation totals must reconcile deterministically.
5. Cross-currency arithmetic is prohibited without an explicit exchange-rate record containing source, effective time, rate direction and rounding policy.
6. API errors expose typed money/currency validation failures. The frontend does not silently coerce invalid numeric input.
7. Existing `number` money fields are compatibility debt and must be migrated per vertical slice before becoming connected backend DTOs.

## Consequences

- The OpenAPI contract defines `DecimalAmount`, `CurrencyCode` and `Money`; future financial operations must reuse these schemas.
- Database constraints and domain tests must verify non-negative/allowed-sign rules and reconciliation invariants.
- CSV/import adapters must parse locale-formatted input into canonical decimal strings before commands are accepted.

## Verification evidence

- `src/shared/money/`
- `src/modules/invoices/domain/`
- `src/modules/payments/domain/`
- `npm run quality:gate -- --gate quality.order-to-cash-money-safety`
- `npm run quality:gate -- --gate quality.payment-allocation-contracts`
- `npm run quality:gate -- --gate quality.contract-baseline`
