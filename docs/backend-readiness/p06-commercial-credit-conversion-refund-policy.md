# Backend Contract Hardening P0.6

Contract version: `0.23.20-contract.0`. Input source SHA-256: `86b73b3f5ae3a76e8ab1cc2def98d7f28e7d6e46aa13f0126471a2c44a8a3059`.

## Closed decisions

- `DEC-P06-ORDER-CREDIT-APPROVAL`: separate, version-bound, single-use approval aggregate.
- `DEC-P06-ACCEPTED-QUOTE-ORDER-CONVERSION`: accepted Quote conversion is a dedicated server-assigned Order creation command.
- `DEC-P06-RETURN-CUSTOMER-CREDIT-POLICY`: Customer-Credit-backed allocations are never automatically reversed or consumed by the Return saga; the saga persists `MANUAL_REVIEW_REQUIRED`.

## Status after later decision packs

These were blockers at the P0.6 checkpoint. They are no longer current contract blockers:

- refund provider attempts, cancellation acknowledgement and retry linkage were closed by P0.8;
- direct-sale Order draft creation, Support and Tasks were closed by P0.7.

Live provider execution remains externally blocked until a backend host and isolated workspaces are supplied. Current status is summarized in `docs/backend-readiness/README.md`.
