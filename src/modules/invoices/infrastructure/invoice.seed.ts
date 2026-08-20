import type { InvoiceRepositorySnapshot } from "../application/ports/InvoiceRepository";

export const INITIAL_INVOICE_STATE: InvoiceRepositorySnapshot = {
  accountingAsOfDate: "2026-07-15",
  invoices: [
    {
      id: "inv_o1_001", invoiceNumber: "INV-2025-0001", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" },
      sellerSnapshot: { displayName: "Unicore Demo Company", legalName: "Unicore Demo Company", taxId: "0100000000", email: "billing@unicore.example", addressLines: ["Hà Nội", "Việt Nam"], countryCode: "VN" },
      buyerSnapshot: { displayName: "Công ty TNHH TechVision", taxId: "0314959291", email: "contact@techvision.vn", addressLines: ["Hà Nội", "Việt Nam"], countryCode: "VN" },
      lifecycleState: "ISSUED", deliveryState: "SENT", issueDate: "2025-06-12", dueDate: "2025-06-15", currency: "VND",
      lines: [{ id: "inv_o1_line_1", orderLineId: "o1_line_1", productId: "p1", description: "Gói triển khai CRM", quantity: "1", unitPrice: { amount: "197400000", currency: "VND" }, discountAmount: { amount: "0", currency: "VND" }, taxAmount: { amount: "0", currency: "VND" }, lineTotal: { amount: "197400000", currency: "VND" } }],
      totals: { subtotal: { amount: "197400000", currency: "VND" }, discountTotal: { amount: "0", currency: "VND" }, taxTotal: { amount: "0", currency: "VND" }, grandTotal: { amount: "197400000", currency: "VND" } },
      sourceLinks: { orderId: "o1" }, version: 2, idempotencyKey: "invoice:o1:full", createdAt: "2025-06-12T08:30:00Z", updatedAt: "2025-06-12T09:00:00Z", issuedAt: "2025-06-12T09:00:00Z",
    },
    {
      id: "inv_o5_deposit", invoiceNumber: "INV-2026-0042", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" },
      sellerSnapshot: { displayName: "Unicore Demo Company", legalName: "Unicore Demo Company", taxId: "0100000000", email: "billing@unicore.example", addressLines: ["Hà Nội", "Việt Nam"], countryCode: "VN" },
      buyerSnapshot: { displayName: "Công ty TNHH TechVision", taxId: "0314959291", email: "contact@techvision.vn", addressLines: ["Hà Nội", "Việt Nam"], countryCode: "VN" },
      lifecycleState: "ISSUED", deliveryState: "NOT_SENT", issueDate: "2026-06-05", dueDate: "2026-06-05", currency: "VND",
      lines: [{ id: "inv_o5_deposit_line", description: "Hóa đơn đặt cọc 30%", quantity: "1", unitPrice: { amount: "4950000", currency: "VND" }, discountAmount: { amount: "0", currency: "VND" }, taxAmount: { amount: "0", currency: "VND" }, lineTotal: { amount: "4950000", currency: "VND" } }],
      totals: { subtotal: { amount: "4950000", currency: "VND" }, discountTotal: { amount: "0", currency: "VND" }, taxTotal: { amount: "0", currency: "VND" }, grandTotal: { amount: "4950000", currency: "VND" } },
      sourceLinks: { orderId: "o5", paymentScheduleLineIds: ["psl_o5_deposit"] }, version: 2, idempotencyKey: "invoice:o5:deposit", createdAt: "2026-06-05T15:00:00Z", updatedAt: "2026-06-05T15:05:00Z", issuedAt: "2026-06-05T15:05:00Z",
    },
  ],
  creditNotes: [],
  deliveries: [{ id: "delivery_inv_o1", invoiceId: "inv_o1_001", channel: "EMAIL", recipient: "contact@techvision.vn", state: "SENT", sentAt: "2025-06-12T09:05:00Z", createdAt: "2025-06-12T09:04:00Z" }],
};
