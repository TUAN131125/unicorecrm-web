import type { PurchaseEvidence } from "../../domain/model/purchaseEvidence.types";

export interface PurchaseEvidenceRepositorySnapshot {
  evidence: PurchaseEvidence[];
}

export interface PurchaseEvidenceRepository {
  snapshot(): PurchaseEvidenceRepositorySnapshot;
  list(): PurchaseEvidence[];
  append(evidence: PurchaseEvidence): PurchaseEvidence;
  runInTransaction<T>(work: () => T): T;
  findById(evidenceId: string): PurchaseEvidence | undefined;
  findBySource(sourceType: PurchaseEvidence["sourceType"], sourceId: string, evidenceType: PurchaseEvidence["evidenceType"]): PurchaseEvidence | undefined;
  findByCorrelation(correlationId: string): PurchaseEvidence | undefined;
  subscribe(listener: (snapshot: PurchaseEvidenceRepositorySnapshot) => void): () => void;
}
