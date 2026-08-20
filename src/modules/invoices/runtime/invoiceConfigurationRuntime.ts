import { BrowserStorageAdapter } from "@/platform/persistence";
import { createWorkspaceScopedRepository, WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import type { InvoiceConfigurationPort } from "../application/ports/InvoiceConfigurationPort";
import { BrowserInvoiceConfigurationRepository } from "../infrastructure/BrowserInvoiceConfigurationRepository";

const storage = new BrowserStorageAdapter();
export const invoiceConfigurationRepository = createWorkspaceScopedRepository<InvoiceConfigurationPort>({
  resourceKey: "invoice_configuration",
  authorizeReads: false,
  createRepository: (workspaceId) => new BrowserInvoiceConfigurationRepository(
    new WorkspaceScopedStorageAdapter(storage, workspaceId, "invoices"),
  ),
});
