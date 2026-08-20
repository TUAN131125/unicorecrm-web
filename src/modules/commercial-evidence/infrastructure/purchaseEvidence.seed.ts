import type { PurchaseEvidence } from "../domain/model/purchaseEvidence.types";

const WORKSPACE_ID = "workspace-default";
const POLICY_VERSION = "historical-evidence-backfill/v1";

function orderEvidence(
  orderId: string,
  buyerRef: PurchaseEvidence["buyerRef"],
  occurredAt: string,
): PurchaseEvidence {
  return {
    evidenceId: `pe_order_${orderId}`,
    workspaceId: WORKSPACE_ID,
    buyerRef,
    sourceType: "ORDER",
    sourceId: orderId,
    evidenceType: "ORDER_COMPLETED",
    occurredAt,
    policyVersion: POLICY_VERSION,
    correlationId: `historical-order:${orderId}`,
  };
}

function importedEvidence(
  legacyCustomerId: string,
  index: number,
  buyerRef: PurchaseEvidence["buyerRef"],
  occurredAt: string,
): PurchaseEvidence {
  return {
    evidenceId: `pe_legacy_${legacyCustomerId}_${index}`,
    workspaceId: WORKSPACE_ID,
    buyerRef,
    sourceType: "EXTERNAL_TRANSACTION",
    sourceId: `legacy-customer:${legacyCustomerId}:purchase:${index}`,
    evidenceType: "HISTORICAL_PURCHASE_IMPORTED",
    occurredAt,
    policyVersion: POLICY_VERSION,
    correlationId: `historical-customer:${legacyCustomerId}:${index}`,
  };
}

/**
 * Deterministic purchase-evidence backfill output. Completed Order facts use
 * their real source Order. Missing historical purchase counts are represented
 * as imported evidence rather than mutable Customer counters.
 */
export const INITIAL_PURCHASE_EVIDENCE: PurchaseEvidence[] = [
  orderEvidence("o1", { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, "2025-06-15T15:30:00.000Z"),
  orderEvidence("o2", { type: "ORGANIZATION_ACCOUNT", id: "org_c1" }, "2025-12-14T09:45:00.000Z"),

  importedEvidence("c2", 1, { type: "ORGANIZATION_ACCOUNT", id: "org_c2" }, "2025-04-15T10:00:00.000Z"),
  importedEvidence("c2", 2, { type: "ORGANIZATION_ACCOUNT", id: "org_c2" }, "2025-08-15T10:00:00.000Z"),
  importedEvidence("c2", 3, { type: "ORGANIZATION_ACCOUNT", id: "org_c2" }, "2025-11-15T10:00:00.000Z"),
  orderEvidence("o3", { type: "ORGANIZATION_ACCOUNT", id: "org_c2" }, "2026-02-20T10:30:00.000Z"),

  importedEvidence("c3", 1, { type: "CONTACT", id: "contact_customer_c3" }, "2025-08-18T10:00:00.000Z"),
  importedEvidence("c3", 2, { type: "CONTACT", id: "contact_customer_c3" }, "2025-11-18T10:00:00.000Z"),
  importedEvidence("c3", 3, { type: "CONTACT", id: "contact_customer_c3" }, "2026-01-18T10:00:00.000Z"),
  importedEvidence("c3", 4, { type: "CONTACT", id: "contact_customer_c3" }, "2026-03-18T10:00:00.000Z"),
  orderEvidence("o4", { type: "CONTACT", id: "contact_customer_c3" }, "2026-05-18T15:55:00.000Z"),

  importedEvidence("c4", 1, { type: "ORGANIZATION_ACCOUNT", id: "org_c4" }, "2026-06-12T10:00:00.000Z"),
  importedEvidence("c5", 1, { type: "ORGANIZATION_ACCOUNT", id: "org_c5" }, "2026-06-11T10:00:00.000Z"),
];
