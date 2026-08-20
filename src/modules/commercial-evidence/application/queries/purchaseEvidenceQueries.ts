import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import type {
  CustomerStatePolicy,
  CustomerStateProjection,
  PurchaseEvidence,
} from "../../domain/model/purchaseEvidence.types";
import { DEFAULT_CUSTOMER_STATE_POLICY } from "../../domain/model/purchaseEvidence.types";
import type { PurchaseEvidenceRepository, PurchaseEvidenceRepositorySnapshot } from "../ports/PurchaseEvidenceRepository";

function listEvidence(source: PurchaseEvidenceRepository | PurchaseEvidenceRepositorySnapshot | readonly PurchaseEvidence[]): PurchaseEvidence[] {
  if ("list" in source) return source.list();
  if ("evidence" in source) return [...source.evidence];
  return [...source];
}

export function getPurchaseEvidenceForRelationship(
  source: PurchaseEvidenceRepository | PurchaseEvidenceRepositorySnapshot | readonly PurchaseEvidence[],
  relationshipRef: RelationshipRef,
): PurchaseEvidence[] {
  const key = relationshipRefKey(relationshipRef);
  return listEvidence(source)
    .filter((item) => relationshipRefKey(item.buyerRef) === key)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export function getEffectivePurchaseEvidence(
  source: PurchaseEvidenceRepository | PurchaseEvidenceRepositorySnapshot | readonly PurchaseEvidence[],
  relationshipRef?: RelationshipRef,
): PurchaseEvidence[] {
  const all = relationshipRef ? getPurchaseEvidenceForRelationship(source, relationshipRef) : listEvidence(source);
  const reversed = new Set(all.filter((item) => item.reversalOfEvidenceId).map((item) => item.reversalOfEvidenceId as string));
  return all.filter((item) => !item.reversalOfEvidenceId && !reversed.has(item.evidenceId));
}

export function projectCustomerState(
  source: PurchaseEvidenceRepository | PurchaseEvidenceRepositorySnapshot | readonly PurchaseEvidence[],
  relationshipRef: RelationshipRef,
  options: {
    now?: string;
    policy?: CustomerStatePolicy;
    activeRelationshipReasons?: readonly string[];
    formerRelationship?: boolean;
  } = {},
): CustomerStateProjection {
  const now = options.now ?? new Date().toISOString();
  const policy = options.policy ?? DEFAULT_CUSTOMER_STATE_POLICY;
  const historical = getPurchaseEvidenceForRelationship(source, relationshipRef).filter((item) => !item.reversalOfEvidenceId);
  const effective = getEffectivePurchaseEvidence(source, relationshipRef);
  const latest = effective.at(-1) ?? historical.at(-1);
  const activeRelationshipReasons = [...(options.activeRelationshipReasons ?? [])];

  let customerState: CustomerStateProjection["customerState"] = "NONE";
  if (historical.length > 0) {
    if (options.formerRelationship) customerState = "FORMER";
    else {
      const latestAt = latest?.occurredAt ? new Date(latest.occurredAt).getTime() : Number.NaN;
      const ageMs = new Date(now).getTime() - latestAt;
      const withinActiveHorizon = Number.isFinite(ageMs) && ageMs <= policy.activeHorizonDays * 86_400_000;
      customerState = withinActiveHorizon || activeRelationshipReasons.length > 0 ? "ACTIVE" : "INACTIVE";
    }
  }

  return {
    relationshipRef,
    customerState,
    calculatedAt: now,
    policyVersion: policy.policyVersion,
    historicalPurchaseCount: historical.length,
    latestPurchaseAt: latest?.occurredAt,
    activeRelationshipReasons,
  };
}
