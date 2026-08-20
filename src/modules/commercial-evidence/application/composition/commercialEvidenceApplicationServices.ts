import { createApplicationServiceBinding } from "@/shared/application";
import type { PurchaseEvidenceRepository } from "../ports/PurchaseEvidenceRepository";

export interface CommercialEvidenceApplicationServices {
  repository: PurchaseEvidenceRepository;
}

const binding = createApplicationServiceBinding<CommercialEvidenceApplicationServices>("Commercial Evidence");
export const configureCommercialEvidenceApplication = binding.configure;
export const getCommercialEvidenceApplicationServices = binding.get;
export const resetCommercialEvidenceApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const purchaseEvidenceRepository = createApplicationServiceProxy(() => binding.get().repository);
