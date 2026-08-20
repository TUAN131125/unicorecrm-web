import type { Customer } from "@/modules/customers/presentation/model/customerDisplay.types";
import type { RelationshipEntityType } from "@/platform/identity";
import type { CanonicalMigrationIssue } from "./migrationIssues";
import { CanonicalMigrationIssueCollector } from "./migrationIssues";

export interface CustomerMigrationPreview {
  legacyCustomerId: string;
  targetRelationshipType: RelationshipEntityType;
  requiresHistoricalEvidenceBackfill: boolean;
  issues: CanonicalMigrationIssue[];
}

export function previewCustomerMigration(customer: Customer): CustomerMigrationPreview {
  const collector = new CanonicalMigrationIssueCollector();
  const targetRelationshipType: RelationshipEntityType =
    customer.type === "COMPANY" ? "ORGANIZATION_ACCOUNT" : "CONTACT";
  const requiresHistoricalEvidenceBackfill =
    (customer.purchaseCount ?? 0) > 0 ||
    customer.productsOwned.length > 0 ||
    Boolean(customer.lastPurchaseDate);

  collector.add({
    sourceType: "Customer",
    sourceId: customer.id,
    disposition: "REVIEW",
    severity: "WARNING",
    rule: "CUSTOMER_AGGREGATE_MUST_RETIRE",
    message: `Legacy Customer must migrate to ${targetRelationshipType} plus Customer View projection; status=${customer.status ?? "unknown"} cannot be copied as customerState.`,
    candidateResolution: requiresHistoricalEvidenceBackfill
      ? "Backfill historical PurchaseEvidence, then calculate customerState from projection policy."
      : "Resolve relationship identity first; customerState remains NONE unless evidence exists.",
  });

  return {
    legacyCustomerId: customer.id,
    targetRelationshipType,
    requiresHistoricalEvidenceBackfill,
    issues: collector.list(),
  };
}
