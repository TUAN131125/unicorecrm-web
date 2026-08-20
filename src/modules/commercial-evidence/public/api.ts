import type { RelationshipRef } from "@/platform/identity";
import { recordPurchaseEvidence, reversePurchaseEvidence } from "../application/commands/purchaseEvidenceCommands";
import { getEffectivePurchaseEvidence, getPurchaseEvidenceForRelationship, projectCustomerState } from "../application/queries/purchaseEvidenceQueries";
import { purchaseEvidenceRepository } from "../application/composition/commercialEvidenceApplicationServices";

export type {
  CustomerState,
  CustomerStatePolicy,
  CustomerStateProjection,
  PurchaseEvidence,
  PurchaseEvidenceSourceType,
  PurchaseEvidenceType,
} from "../domain/model/purchaseEvidence.types";
export { DEFAULT_CUSTOMER_STATE_POLICY } from "../domain/model/purchaseEvidence.types";
export type { PurchaseEvidenceRepository, PurchaseEvidenceRepositorySnapshot } from "../application/ports/PurchaseEvidenceRepository";
export { validatePurchaseEvidence, assertValidPurchaseEvidence, purchaseEvidenceSourceKey } from "../domain/rules/purchaseEvidenceRules";
export { recordPurchaseEvidence, reversePurchaseEvidence } from "../application/commands/purchaseEvidenceCommands";
export { getEffectivePurchaseEvidence, getPurchaseEvidenceForRelationship, projectCustomerState } from "../application/queries/purchaseEvidenceQueries";

export const getPurchaseEvidenceSnapshot = () => purchaseEvidenceRepository.snapshot();
export const getPurchaseEvidenceListSnapshot = () => purchaseEvidenceRepository.list();
export const runCommercialEvidenceTransaction = <T>(work: () => T): T => purchaseEvidenceRepository.runInTransaction(work);
export const subscribeToPurchaseEvidence = (listener: Parameters<typeof purchaseEvidenceRepository.subscribe>[0]) => purchaseEvidenceRepository.subscribe(listener);
export const subscribeToPurchaseEvidenceList = (listener: (evidence: ReturnType<typeof purchaseEvidenceRepository.list>) => void) => purchaseEvidenceRepository.subscribe(() => listener(purchaseEvidenceRepository.list()));
export const getPurchaseEvidenceBySource = (sourceType: Parameters<typeof purchaseEvidenceRepository.findBySource>[0], sourceId: string, evidenceType: Parameters<typeof purchaseEvidenceRepository.findBySource>[2]) => purchaseEvidenceRepository.findBySource(sourceType, sourceId, evidenceType);
export const getPurchaseEvidenceForRelationshipSnapshot = (relationshipRef: RelationshipRef) => getPurchaseEvidenceForRelationship(purchaseEvidenceRepository, relationshipRef);
export const getEffectivePurchaseEvidenceForRelationshipSnapshot = (relationshipRef: RelationshipRef) => getEffectivePurchaseEvidence(purchaseEvidenceRepository, relationshipRef);
export const getCustomerStateProjectionSnapshot = (relationshipRef: RelationshipRef, options?: Parameters<typeof projectCustomerState>[2]) => projectCustomerState(purchaseEvidenceRepository, relationshipRef, options);
export const recordCommercialEvidence = (command: Parameters<typeof recordPurchaseEvidence>[1]) => recordPurchaseEvidence(purchaseEvidenceRepository, command);
export const reverseCommercialEvidence = (command: Parameters<typeof reversePurchaseEvidence>[1]) => reversePurchaseEvidence(purchaseEvidenceRepository, command);
