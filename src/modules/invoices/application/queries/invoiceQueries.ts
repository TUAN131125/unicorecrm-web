import { getReceivableConfiguration } from "@/platform/configuration-runtime";
import type { InvoiceRepository, InvoiceRepositorySnapshot } from "../ports/InvoiceRepository";
import type { ReceivableAllocationInput, ReceivableCreditInput } from "../../domain/rules/invoiceRules";
import { projectReceivable } from "../../domain/rules/invoiceRules";
import type { Invoice, ReceivableEntry } from "../../domain/model/invoice.types";

const snapshotOf = (source: InvoiceRepository | InvoiceRepositorySnapshot): InvoiceRepositorySnapshot => "snapshot" in source ? source.snapshot() : source;

export function queryInvoices(source: InvoiceRepository | InvoiceRepositorySnapshot, input: { search?: string; state?: string; buyerId?: string; orderId?: string } = {}): Invoice[] {
  const search = input.search?.trim().toLowerCase() ?? "";
  return snapshotOf(source).invoices
    .filter((item) => !input.state || input.state === "ALL" || item.lifecycleState === input.state)
    .filter((item) => !input.buyerId || item.buyerRef.id === input.buyerId)
    .filter((item) => !input.orderId || item.sourceLinks.orderId === input.orderId)
    .filter((item) => !search || [item.invoiceNumber, item.id, item.buyerSnapshot.displayName, item.sourceLinks.orderId].filter(Boolean).some((value) => String(value).toLowerCase().includes(search)))
    .sort((a, b) => (b.issueDate ?? b.createdAt).localeCompare(a.issueDate ?? a.createdAt));
}

export function getInvoiceById(source: InvoiceRepository | InvoiceRepositorySnapshot, invoiceId: string): Invoice | undefined {
  return snapshotOf(source).invoices.find((item) => item.id === invoiceId);
}

export function buildReceivables(
  source: InvoiceRepository | InvoiceRepositorySnapshot,
  allocations: readonly ReceivableAllocationInput[],
  credits: readonly ReceivableCreditInput[],
  asOfDate: string,
): ReceivableEntry[] {
  const agingBuckets = getReceivableConfiguration().agingBuckets;
  return snapshotOf(source).invoices.map((invoice) => projectReceivable(invoice, allocations, credits, asOfDate, agingBuckets)).filter((item): item is ReceivableEntry => Boolean(item)).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}
