import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { InMemoryPurchaseEvidenceRepository } from "../infrastructure/InMemoryPurchaseEvidenceRepository";
import { INITIAL_PURCHASE_EVIDENCE } from "../infrastructure/purchaseEvidence.seed";

export const purchaseEvidenceRepository = createWorkspaceScopedRepository({
  resourceKey: "commercial-evidence",
  authorizeReads: false,
  createRepository: () => new InMemoryPurchaseEvidenceRepository(structuredClone(INITIAL_PURCHASE_EVIDENCE)),
});
