import type { BuyerRef } from "@/platform/identity";
import type { CanonicalMigrationDisposition, CanonicalMigrationIssue } from "./migrationIssues";
import { CanonicalMigrationIssueCollector } from "./migrationIssues";

export interface HistoricalPurchaseMigrationSource {
  sourceId: string;
  buyerRef?: BuyerRef;
  sourceType: "ORDER" | "LEGACY_CUSTOMER_PROFILE" | "EXTERNAL_TRANSACTION";
  completed?: boolean;
  occurredAt?: string;
  historicalPurchaseCount?: number;
  knownEvidenceCount?: number;
}

export interface HistoricalPurchaseEvidencePreview {
  sourceId: string;
  disposition: CanonicalMigrationDisposition;
  evidenceToCreate: number;
  issues: CanonicalMigrationIssue[];
}

export function previewHistoricalPurchaseEvidenceMigration(
  source: HistoricalPurchaseMigrationSource,
): HistoricalPurchaseEvidencePreview {
  const collector = new CanonicalMigrationIssueCollector();
  let disposition: CanonicalMigrationDisposition = "SAFE";
  let evidenceToCreate = 0;

  if (!source.buyerRef?.id) {
    disposition = "REVIEW";
    collector.add({
      sourceType: "CommercialEvidence",
      sourceId: source.sourceId,
      disposition: "REVIEW",
      severity: "ERROR",
      rule: "PURCHASE_EVIDENCE_REQUIRES_BUYER",
      message: "Historical purchase evidence cannot be backfilled without Contact or Organization Account buyer identity.",
    });
  }

  if (source.sourceType === "ORDER") {
    if (!source.completed) {
      disposition = "SAFE";
      collector.add({
        sourceType: "Order",
        sourceId: source.sourceId,
        disposition: "SAFE",
        severity: "INFO",
        rule: "NON_COMPLETED_ORDER_CREATES_NO_EVIDENCE",
        message: "Only completed historical Orders create ORDER_COMPLETED evidence.",
      });
    } else if (!source.occurredAt) {
      disposition = "REVIEW";
      collector.add({
        sourceType: "Order",
        sourceId: source.sourceId,
        disposition: "REVIEW",
        severity: "WARNING",
        rule: "COMPLETED_ORDER_EVIDENCE_REQUIRES_OCCURRED_AT",
        message: "Completed historical Order needs completion time before evidence backfill.",
      });
    } else if (disposition !== "REVIEW") {
      disposition = "INFER";
      evidenceToCreate = 1;
      collector.add({
        sourceType: "Order",
        sourceId: source.sourceId,
        disposition: "INFER",
        severity: "INFO",
        rule: "BACKFILL_ORDER_COMPLETED_EVIDENCE",
        message: "Completed historical Order can deterministically create one ORDER_COMPLETED evidence fact.",
      });
    }
  }

  if (source.sourceType === "LEGACY_CUSTOMER_PROFILE") {
    const historicalCount = Math.max(0, source.historicalPurchaseCount ?? 0);
    const knownCount = Math.max(0, source.knownEvidenceCount ?? 0);
    evidenceToCreate = Math.max(0, historicalCount - knownCount);
    if (evidenceToCreate > 0 && disposition !== "REVIEW") {
      disposition = "INFER";
      collector.add({
        sourceType: "LegacyCustomerProfile",
        sourceId: source.sourceId,
        disposition: "INFER",
        severity: "INFO",
        rule: "BACKFILL_MISSING_HISTORICAL_PURCHASE_EVIDENCE",
        message: `${evidenceToCreate} historical purchase facts are missing from known source records and require imported evidence.`,
      });
    }
  }

  return { sourceId: source.sourceId, disposition, evidenceToCreate, issues: collector.list() };
}
