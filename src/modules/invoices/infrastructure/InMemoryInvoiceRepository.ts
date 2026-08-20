import type { InvoiceRepository, InvoiceRepositorySnapshot } from "../application/ports/InvoiceRepository";
import type { CreditNote, Invoice, InvoiceDeliveryRecord } from "../domain/model/invoice.types";
import { assertIssuedInvoiceUnchanged } from "../application/commands/invoiceCommands";

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private state: InvoiceRepositorySnapshot;
  private readonly listeners = new Set<(snapshot: InvoiceRepositorySnapshot) => void>();
  constructor(seed: Partial<InvoiceRepositorySnapshot> = {}) {
    this.state = { accountingAsOfDate: seed.accountingAsOfDate ?? "2026-07-15", invoices: structuredClone(seed.invoices ?? []), creditNotes: structuredClone(seed.creditNotes ?? []), deliveries: structuredClone(seed.deliveries ?? []) };
  }
  snapshot(): InvoiceRepositorySnapshot { return structuredClone(this.state); }
  getAccountingAsOfDate(): string { return this.state.accountingAsOfDate; }
  listInvoices(): Invoice[] { return structuredClone(this.state.invoices); }
  listCreditNotes(): CreditNote[] { return structuredClone(this.state.creditNotes); }
  listDeliveries(): InvoiceDeliveryRecord[] { return structuredClone(this.state.deliveries); }
  saveInvoice(invoice: Invoice): Invoice {
    const current = this.state.invoices.find((item) => item.id === invoice.id);
    if (current) assertIssuedInvoiceUnchanged(current, invoice);
    this.state = { ...this.state, invoices: [structuredClone(invoice), ...this.state.invoices.filter((item) => item.id !== invoice.id)] };
    this.emit(); return structuredClone(invoice);
  }
  saveCreditNote(note: CreditNote): CreditNote { this.state = { ...this.state, creditNotes: [structuredClone(note), ...this.state.creditNotes.filter((item) => item.id !== note.id)] }; this.emit(); return structuredClone(note); }
  saveDelivery(delivery: InvoiceDeliveryRecord): InvoiceDeliveryRecord { this.state = { ...this.state, deliveries: [structuredClone(delivery), ...this.state.deliveries.filter((item) => item.id !== delivery.id)] }; this.emit(); return structuredClone(delivery); }
  replace(snapshot: InvoiceRepositorySnapshot): void { this.state = structuredClone(snapshot); this.emit(); }
  subscribe(listener: (snapshot: InvoiceRepositorySnapshot) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(): void { const snapshot = this.snapshot(); this.listeners.forEach((listener) => listener(snapshot)); }
}
