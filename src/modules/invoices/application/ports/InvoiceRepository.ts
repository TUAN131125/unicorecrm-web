import type { CreditNote, Invoice, InvoiceDeliveryRecord } from "../../domain/model/invoice.types";

export interface InvoiceRepositorySnapshot {
  /** Authoritative accounting date supplied by the backend/dev adapter; UI device clocks must not decide aging. */
  accountingAsOfDate: string;
  invoices: Invoice[];
  creditNotes: CreditNote[];
  deliveries: InvoiceDeliveryRecord[];
}

export interface InvoiceRepository {
  snapshot(): InvoiceRepositorySnapshot;
  getAccountingAsOfDate(): string;
  listInvoices(): Invoice[];
  listCreditNotes(): CreditNote[];
  listDeliveries(): InvoiceDeliveryRecord[];
  saveInvoice(invoice: Invoice): Invoice;
  saveCreditNote(creditNote: CreditNote): CreditNote;
  saveDelivery(delivery: InvoiceDeliveryRecord): InvoiceDeliveryRecord;
  replace(snapshot: InvoiceRepositorySnapshot): void;
  subscribe(listener: (snapshot: InvoiceRepositorySnapshot) => void): () => void;
}
