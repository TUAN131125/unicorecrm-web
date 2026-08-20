import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { InMemoryInvoiceRepository } from "../infrastructure/InMemoryInvoiceRepository";
import { InMemoryInvoiceApiAdapter } from "../infrastructure/InMemoryInvoiceApiAdapter";
import { INITIAL_INVOICE_STATE } from "../infrastructure/invoice.seed";
import type { InvoiceApiPort } from "../application/ports/InvoiceApiPort";

export const invoiceRepository = createWorkspaceScopedRepository({ resourceKey: "invoices", createRepository: () => new InMemoryInvoiceRepository(structuredClone(INITIAL_INVOICE_STATE)) });
export const invoiceApi: InvoiceApiPort = new InMemoryInvoiceApiAdapter(invoiceRepository);
