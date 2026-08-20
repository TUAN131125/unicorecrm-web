# Canonical money contract

Contract version: `0.23.20-contract.0`.

## Production authority
- Amount representation: `DECIMAL_STRING`
- Maximum scale: `6`
- Precision: `UNRESOLVED_DATABASE_PRECISION`
- Rounding: `HALF_UP`
- Currency pattern: `^[A-Z]{3}$`
- Currency owner: `WORKSPACE_CONFIGURATION`
- Negative policy: SCHEMA/OPERATION_SPECIFIC
- Tax semantics: UNRESOLVED_PER_COMMERCIAL_DOCUMENT
- Allocation residual: UNRESOLVED; financial allocation operations BLOCKED

Frontend numeric money occurrences inventoried: **201**. Their policy is `Demo/UI models only. They MUST NOT cross a connected production adapter.`; they are not production HTTP authority.
