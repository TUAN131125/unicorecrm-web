# Existing-document reconciliation

Status: NON_AUTHORITATIVE REVIEW. Existing `docs/` files were not modified.

Policy: source and machine contracts were reconstructed first; document status/authority was then checked against source. No blanket `ADOPT_WITH_CORRECTION` claim is made. CURRENT/CANONICAL prose is a SOURCE_FIRST_REVIEWED_INPUT and contributes only statements corroborated by the cited source/OpenAPI; round-1 corrections are retrievable in `independent-review-round-1-resolution.md`, contract reconciliation and contradiction evidence. TARGET is not treated as current runtime truth. Generated ledgers are supporting indexes. OpenAPI is adopted by path/hash, not copied.

| Document | Declared status | Declared authority | Reconciliation | Canonical destination |
|---|---|---|---|---|
| `docs/README.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | supporting evidence only |
| `docs/ai/SKILLS.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | supporting evidence only |
| `docs/api/README.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | canonical-design/contracts |
| `docs/api/api-operation-catalog.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | canonical-design/contracts |
| `docs/api/generated-client-manifest.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | canonical-design/contracts |
| `docs/api/openapi-breaking-baseline.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | canonical-design/contracts |
| `docs/api/openapi.json` | REFERENCE | SUPPORTING | ADOPT | canonical-design/contracts |
| `docs/api/openapi.sha256` | REFERENCE | SUPPORTING | ADOPT | canonical-design/contracts |
| `docs/api/operation-coverage-ledger.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | canonical-design/contracts |
| `docs/architecture/api-contract-and-generated-client.md` | CURRENT | CANONICAL | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/application-composition.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/backend-authoritative-audit-viewer.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/backend-readiness.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/architecture/code-splitting-and-bundle-budget.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/compatibility-and-migration.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/compatibility-ledger.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/compatibility-ledger.md` | CURRENT | CANONICAL | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/compatibility-retirement-stage6.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/contact-organization-relationships.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/data-defaults-and-demo-runtime.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/deal-api-boundary.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/deal-stage-window-query.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/decisions/ADR-001-identity-and-authentication.md` | TARGET | CANONICAL | TARGET_DESIGN | architecture/ownership/security |
| `docs/architecture/decisions/ADR-002-workspace-tenancy.md` | TARGET | CANONICAL | TARGET_DESIGN | architecture/ownership/security |
| `docs/architecture/decisions/ADR-003-money-and-rounding.md` | TARGET | CANONICAL | TARGET_DESIGN | architecture/ownership/security |
| `docs/architecture/decisions/ADR-004-concurrency-and-idempotency.md` | TARGET | CANONICAL | TARGET_DESIGN | architecture/ownership/security |
| `docs/architecture/decisions/ADR-005-workflow-transactions-and-events.md` | TARGET | CANONICAL | TARGET_DESIGN | architecture/ownership/security |
| `docs/architecture/decisions/ADR-006-dotnet-modular-monolith-and-sqlserver.md` | TARGET | CANONICAL | TARGET_DESIGN | architecture/ownership/security |
| `docs/architecture/decisions/README.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/dependency-boundaries.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/dotnet-sqlserver-backend-target.md` | TARGET | CANONICAL | TARGET_DESIGN | architecture/ownership/security |
| `docs/architecture/effective-record-access.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/error-handling.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/external-authority-health.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/financial-operations-api-boundary.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/http-api-foundation.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/large-file-presentation-responsibility-stage7.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/lead-api-boundary.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/lead-identity-governance.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/module-api-boundary-template.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/module-ownership-and-workflows.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/mutation-command-authority.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/presentation-responsibility.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/product-order-api-boundary.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/quote-api-boundary.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/record-retention-and-destructive-actions.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/reference-financial-vertical-slice.md` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | architecture/ownership/security |
| `docs/architecture/relationship-domain-api-boundary.md` | CURRENT | AUTHORITATIVE | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/routing-shell-and-access-control.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/server-side-list-query.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/architecture/shipping-returns-api-boundary.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/task-activity-api-boundary.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/type-ownership.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | architecture/ownership/security |
| `docs/architecture/type-safety-and-strictness.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | architecture/ownership/security |
| `docs/backend-readiness/README.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/api-evolution-policy.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/api-evolution-policy.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/capability-inventory.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/command-registry.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | contracts/use cases/decisions |
| `docs/backend-readiness/command-registry.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/commercial-evidence-ownership.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/commercial-evidence-ownership.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/concurrency-policy.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/concurrency-policy.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/contract-inventory.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/credit-approval-command-decision.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/credit-approval-command-decision.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/endpoint-ownership.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/error-catalog.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | contracts/use cases/decisions |
| `docs/backend-readiness/error-catalog.md` | TARGET | CANONICAL | SUPPORTING_ONLY | contracts/use cases/decisions |
| `docs/backend-readiness/idempotency-policy.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/idempotency-policy.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/identity-auth-session-contract.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/invoice-provider-contract-pack.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/lead-lifecycle-qualification-decision.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/lead-lifecycle-qualification-decision.md` | CURRENT | DECISION_RECORD | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/lead-lifecycle.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/lead-lifecycle.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/lead-profile-contract-decision.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/lifecycle-enum-inventory.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/money-contract.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/money-contract.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/operation-authorization-matrix.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/operation-authorization-matrix.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/operation-contract-status.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p01-domain-decision-closure.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p01-domain-decision-closure.md` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p02-transaction-semantics.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p02-transaction-semantics.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/p03-commercial-read-models.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p03-commercial-read-models.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/p04-payment-ledger-semantics.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | contracts/use cases/decisions |
| `docs/backend-readiness/p04-payment-ledger-semantics.md` | CURRENT | CANONICAL | SUPPORTING_ONLY | contracts/use cases/decisions |
| `docs/backend-readiness/p05-return-refund-payment-plan-intent.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p05-return-refund-payment-plan-intent.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/p06-commercial-credit-conversion-refund-policy.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p06-commercial-credit-conversion-refund-policy.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/p07-order-support-tasks-refund-recovery.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p07-order-support-tasks-refund-recovery.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/p08-refund-provider-recovery.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p08-refund-provider-recovery.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/p09-provider-conformance-query-closure.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p09-provider-conformance-query-closure.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/p10-provider-adapter-registry-closure.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/p10-provider-adapter-registry-closure.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | contracts/use cases/decisions |
| `docs/backend-readiness/payment-financial-effects-decisions.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/payment-plan-intent-money-contract.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/payment-plan-intent-money-contract.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/query-registry.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | contracts/use cases/decisions |
| `docs/backend-readiness/query-registry.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/quote-order-conversion-decision.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/quote-order-conversion-decision.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/quote-order-transaction-contract.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/remediation-ledger.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | contracts/use cases/decisions |
| `docs/backend-readiness/remediation-ledger.md` | TARGET | CANONICAL | SUPPORTING_ONLY | contracts/use cases/decisions |
| `docs/backend-readiness/return-refund-saga.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/return-refund-saga.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/server-like-evidence-inventory.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/support-tasks-contract-status.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/support-tasks-contract-status.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/transaction-provider-contract-pack.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | contracts/use cases/decisions |
| `docs/backend-readiness/unresolved-decisions.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/unresolved-decisions.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/backend-readiness/workflow-ownership.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | contracts/use cases/decisions |
| `docs/backend-readiness/workflow-ownership.md` | TARGET | CANONICAL | TARGET_DESIGN | contracts/use cases/decisions |
| `docs/business/customer-relationship-and-commercial-flow.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | business rules/modules/workflows |
| `docs/business/deployment-operations-forecast-and-ai-governance.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | business rules/modules/workflows |
| `docs/business/enterprise-security-and-resilience.md` | TARGET | SUPPORTING | TARGET_DESIGN | business rules/modules/workflows |
| `docs/business/metric-catalog-and-reporting.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | business rules/modules/workflows |
| `docs/business/order-to-cash-frontend-build-spec.md` | TARGET | SUPPORTING | TARGET_DESIGN | business rules/modules/workflows |
| `docs/business/order-to-cash-operations.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | business rules/modules/workflows |
| `docs/business/payment-plans-and-collections-frontend-spec.md` | TARGET | SUPPORTING | TARGET_DESIGN | business rules/modules/workflows |
| `docs/business/pilot-end-to-end-acceptance.md` | TRACKER | SUPPORTING | SUPPORTING_ONLY | business rules/modules/workflows |
| `docs/business/role-based-navigation-and-product-language.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | business rules/modules/workflows |
| `docs/business/sales-quick-create-and-pipeline-health.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | business rules/modules/workflows |
| `docs/business/shipping-and-returns.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | business rules/modules/workflows |
| `docs/document-status.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | supporting evidence only |
| `docs/product/guidance-screen-inventory.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | supporting evidence only |
| `docs/product/guidance-system.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | supporting evidence only |
| `docs/product/studio-rebuild-roadmap.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | supporting evidence only |
| `docs/quality/api-contract-verification.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | supporting evidence only |
| `docs/quality/backend-readiness-verification.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | contracts/use cases/decisions |
| `docs/quality/ci-and-release.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | supporting evidence only |
| `docs/quality/connected-backend-acceptance.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | supporting evidence only |
| `docs/quality/form-and-presentation-contracts.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | supporting evidence only |
| `docs/quality/quality-pipeline.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | supporting evidence only |
| `docs/quality/release-identity.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | supporting evidence only |
| `docs/quality/release-identity.md` | CURRENT | CANONICAL | SOURCE_FIRST_REVIEWED_INPUT | supporting evidence only |
| `docs/quality/repository-inventory.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | supporting evidence only |
| `docs/quality/repository-inventory.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | supporting evidence only |
| `docs/quality/script-modernization/baseline-audit.md` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | supporting evidence only |
| `docs/quality/script-modernization/baseline-inventory.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | supporting evidence only |
| `docs/quality/script-modernization/change-ledger.json` | REFERENCE | SUPPORTING | SUPPORTING_ONLY | supporting evidence only |
| `docs/quality/script-modernization/script-classification.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | supporting evidence only |
| `docs/quality/script-modernization/sr2-migration-inventory.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | supporting evidence only |
| `docs/quality/script-modernization/sr2-quality-test-ownership-report.md` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | supporting evidence only |
| `docs/quality/script-modernization/verification-matrix.json` | REFERENCE | SUPPORTING | HISTORICAL_REFERENCE | supporting evidence only |
| `docs/quality/source-packaging.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | supporting evidence only |
| `docs/quality/verification.md` | CURRENT | SUPPORTING | SUPPORTING_ONLY | supporting evidence only |
