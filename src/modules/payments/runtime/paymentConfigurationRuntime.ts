import { BrowserStorageAdapter } from "@/platform/persistence";
import { createWorkspaceScopedRepository, WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import type { PaymentConfigurationPort } from "../application/ports/PaymentConfigurationPort";
import { BrowserPaymentConfigurationRepository } from "../infrastructure/BrowserPaymentConfigurationRepository";

const storage = new BrowserStorageAdapter();
export const paymentConfigurationRepository = createWorkspaceScopedRepository<PaymentConfigurationPort>({
  resourceKey: "payment_configuration",
  authorizeReads: false,
  createRepository: (workspaceId) => new BrowserPaymentConfigurationRepository(
    new WorkspaceScopedStorageAdapter(storage, workspaceId, "payments"),
  ),
});
