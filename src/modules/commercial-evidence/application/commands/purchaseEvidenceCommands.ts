import { assertRuntimeWorkspaceAccess } from "@/platform/access-control";
import type { BuyerRef } from "@/platform/identity";
import type { PurchaseEvidence } from "../../domain/model/purchaseEvidence.types";
import { assertValidPurchaseEvidence } from "../../domain/rules/purchaseEvidenceRules";
import type { PurchaseEvidenceRepository } from "../ports/PurchaseEvidenceRepository";

export interface RecordPurchaseEvidenceCommand {
  evidenceId: string;
  workspaceId: string;
  buyerRef: BuyerRef;
  sourceType: PurchaseEvidence["sourceType"];
  sourceId: string;
  evidenceType: PurchaseEvidence["evidenceType"];
  occurredAt: string;
  policyVersion: string;
  correlationId: string;
  amount?: number;
  currency?: string;
  productSummary?: string;
  documentRef?: string;
  note?: string;
  confirmedBy?: string;
  sourceSystem?: string;
  externalCustomerRef?: string;
}

export function recordPurchaseEvidence(
  repository: PurchaseEvidenceRepository,
  command: RecordPurchaseEvidenceCommand,
): PurchaseEvidence {
  assertRuntimeWorkspaceAccess(command.workspaceId);
  const existingBySource = repository.findBySource(command.sourceType, command.sourceId, command.evidenceType);
  if (existingBySource) return existingBySource;
  const existingByCorrelation = repository.findByCorrelation(command.correlationId);
  if (existingByCorrelation) return existingByCorrelation;

  const evidence: PurchaseEvidence = { ...command };
  assertValidPurchaseEvidence(evidence);
  return repository.append(evidence);
}

export interface ReversePurchaseEvidenceCommand {
  evidenceId: string;
  workspaceId: string;
  originalEvidenceId: string;
  occurredAt: string;
  policyVersion: string;
  correlationId: string;
  amount?: number;
  currency?: string;
  productSummary?: string;
  documentRef?: string;
  note?: string;
  confirmedBy?: string;
  sourceSystem?: string;
  externalCustomerRef?: string;
}

export function reversePurchaseEvidence(
  repository: PurchaseEvidenceRepository,
  command: ReversePurchaseEvidenceCommand,
): PurchaseEvidence {
  assertRuntimeWorkspaceAccess(command.workspaceId);
  const original = repository.findById(command.originalEvidenceId);
  if (!original) throw new Error("Original PurchaseEvidence not found.");
  const existingReversal = repository.list().find((item) => item.reversalOfEvidenceId === original.evidenceId);
  if (existingReversal) return existingReversal;

  const reversal: PurchaseEvidence = {
    evidenceId: command.evidenceId,
    workspaceId: command.workspaceId,
    buyerRef: original.buyerRef,
    sourceType: original.sourceType,
    sourceId: `${original.sourceId}:reversal`,
    evidenceType: original.evidenceType,
    occurredAt: command.occurredAt,
    policyVersion: command.policyVersion,
    correlationId: command.correlationId,
    reversalOfEvidenceId: original.evidenceId,
  };
  assertValidPurchaseEvidence(reversal);
  return repository.append(reversal);
}
