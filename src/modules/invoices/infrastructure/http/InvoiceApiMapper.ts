import type {
  CreditNoteDocument,
  InvoiceDeliveryDocument,
  InvoiceDocument,
} from "@/platform/api/generated/financialApi";
import type {
  CreditNote,
  Invoice,
  InvoiceDeliveryRecord,
} from "../../domain/model/invoice.types";

export function mapInvoiceDocument(value: InvoiceDocument): Invoice {
  return {
    ...value,
    sellerSnapshot: { ...value.sellerSnapshot, addressLines: [...value.sellerSnapshot.addressLines] },
    buyerSnapshot: { ...value.buyerSnapshot, addressLines: [...value.buyerSnapshot.addressLines] },
    lines: value.lines.map((line) => ({ ...line })),
    totals: { ...value.totals },
    sourceLinks: {
      ...value.sourceLinks,
      paymentScheduleLineIds: value.sourceLinks.paymentScheduleLineIds ? [...value.sourceLinks.paymentScheduleLineIds] : undefined,
      shippingBookingIds: value.sourceLinks.shippingBookingIds ? [...value.sourceLinks.shippingBookingIds] : undefined,
      returnIds: value.sourceLinks.returnIds ? [...value.sourceLinks.returnIds] : undefined,
      milestoneCodes: value.sourceLinks.milestoneCodes ? [...value.sourceLinks.milestoneCodes] : undefined,
    },
    issueEvidence: value.issueEvidence?.map((item) => ({ ...item })),
  } as Invoice;
}

export function mapCreditNoteDocument(value: CreditNoteDocument): CreditNote {
  return {
    ...value,
    lines: value.lines.map((line) => ({ ...line })),
    version: value.resourceVersion,
  };
}

export function mapInvoiceDeliveryDocument(value: InvoiceDeliveryDocument): InvoiceDeliveryRecord {
  return {
    id: value.id,
    invoiceId: value.invoiceId,
    channel: value.channel,
    ...(value.recipient === undefined ? {} : { recipient: value.recipient }),
    state: value.state,
    ...(value.sentAt === undefined ? {} : { sentAt: value.sentAt }),
    ...(value.failureCode === undefined ? {} : { failureCode: value.failureCode }),
    createdAt: value.createdAt,
  };
}
