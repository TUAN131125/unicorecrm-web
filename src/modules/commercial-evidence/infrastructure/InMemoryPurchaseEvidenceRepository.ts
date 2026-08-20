import type { PurchaseEvidence } from "../domain/model/purchaseEvidence.types";
import { assertValidPurchaseEvidence, purchaseEvidenceSourceKey } from "../domain/rules/purchaseEvidenceRules";
import type {
  PurchaseEvidenceRepository,
  PurchaseEvidenceRepositorySnapshot,
} from "../application/ports/PurchaseEvidenceRepository";

export class InMemoryPurchaseEvidenceRepository implements PurchaseEvidenceRepository {
  private evidence: PurchaseEvidence[];
  private readonly listeners = new Set<(snapshot: PurchaseEvidenceRepositorySnapshot) => void>();

  constructor(seed: readonly PurchaseEvidence[] = []) {
    this.evidence = seed.map((item) => structuredClone(item));
    this.evidence.forEach(assertValidPurchaseEvidence);
  }

  snapshot(): PurchaseEvidenceRepositorySnapshot {
    return { evidence: structuredClone(this.evidence) };
  }

  list(): PurchaseEvidence[] {
    return structuredClone(this.evidence);
  }

  runInTransaction<T>(work: () => T): T {
    const before = structuredClone(this.evidence);
    try {
      return work();
    } catch (error) {
      this.evidence = before;
      this.evidence.forEach(assertValidPurchaseEvidence);
      this.emit();
      throw error;
    }
  }

  append(evidence: PurchaseEvidence): PurchaseEvidence {
    assertValidPurchaseEvidence(evidence);
    const byId = this.findById(evidence.evidenceId);
    if (byId) return byId;
    const sourceKey = purchaseEvidenceSourceKey(evidence);
    const bySource = this.evidence.find((item) => purchaseEvidenceSourceKey(item) === sourceKey);
    if (bySource) return structuredClone(bySource);
    const byCorrelation = this.findByCorrelation(evidence.correlationId);
    if (byCorrelation) return byCorrelation;

    this.evidence = [...this.evidence, structuredClone(evidence)];
    this.emit();
    return structuredClone(evidence);
  }

  findById(evidenceId: string): PurchaseEvidence | undefined {
    const found = this.evidence.find((item) => item.evidenceId === evidenceId);
    return found ? structuredClone(found) : undefined;
  }

  findBySource(sourceType: PurchaseEvidence["sourceType"], sourceId: string, evidenceType: PurchaseEvidence["evidenceType"]): PurchaseEvidence | undefined {
    const found = this.evidence.find((item) => item.sourceType === sourceType && item.sourceId === sourceId && item.evidenceType === evidenceType);
    return found ? structuredClone(found) : undefined;
  }

  findByCorrelation(correlationId: string): PurchaseEvidence | undefined {
    const found = this.evidence.find((item) => item.correlationId === correlationId);
    return found ? structuredClone(found) : undefined;
  }

  subscribe(listener: (snapshot: PurchaseEvidenceRepositorySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
