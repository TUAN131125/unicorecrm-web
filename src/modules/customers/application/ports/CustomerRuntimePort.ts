import type { RelationshipRef } from "@/platform/identity";
import type { CustomerRepositorySnapshot } from "../../domain/model/customer.types";

export interface CustomerMigrationProfile {
  relationshipRef: RelationshipRef;
  legacyCustomerId: string;
  legacyCustomerCode: string;
  customerState?: "NONE" | "ACTIVE" | "INACTIVE" | "FORMER";
  historicalPurchaseCount?: number;
  latestPurchaseAt?: string;
  segment?: string;
  source?: string;
  totalRevenue: number;
  outstandingDebt: number;
  purchaseCycleDays?: number;
  monthlyRecurringRevenue: number;
  renewalAt?: string;
  nextCareAt?: string;
  lastCareAt?: string;
  health: "GOOD" | "WATCH" | "RISK";
  ownedProducts: Array<{ id: string; productId: string; productName: string; quantity: number; purchasedAt: string; amount: number; status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "RENEWAL_DUE"; expiresAt?: string }>;
}

export interface CustomerRuntimePort {
  ensureReady(): void;
  reconcileFromPurchaseEvidence(now?: string): CustomerRepositorySnapshot;
  getMigrationProfile(ref: RelationshipRef): CustomerMigrationProfile | undefined;
}
