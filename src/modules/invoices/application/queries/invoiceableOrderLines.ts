import type { CustomerOrder } from "@/modules/orders";
import type { Invoice } from "../../domain/model/invoice.types";

export interface InvoiceableOrderLineDto {
  orderLineId: string;
  productId: string;
  skuSnapshot?: string;
  description: string;
  orderedQuantity: string;
  alreadyInvoicedQuantity: string;
  invoiceableQuantity: string;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
}

function decimal(value: string | number | undefined): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export function getInvoiceableOrderLines(
  order: CustomerOrder,
  invoices: readonly Invoice[],
  excludeInvoiceId?: string,
): InvoiceableOrderLineDto[] {
  const activeInvoices = invoices.filter((invoice) =>
    invoice.id !== excludeInvoiceId
    && invoice.sourceLinks.orderId === order.id
    && !["DISCARDED", "VOIDED"].includes(invoice.lifecycleState));

  return order.items.map((orderLine) => {
    const alreadyInvoiced = activeInvoices.reduce((total, invoice) => total + invoice.lines
      .filter((line) => (line.sourceOrderLineId ?? line.orderLineId) === orderLine.id)
      .reduce((lineTotal, line) => lineTotal + decimal(line.quantity), 0), 0);
    const invoiceable = Math.max(0, orderLine.quantity - alreadyInvoiced);
    return {
      orderLineId: orderLine.id,
      productId: orderLine.productId,
      skuSnapshot: orderLine.skuSnapshot,
      description: orderLine.descriptionSnapshot || orderLine.productNameSnapshot,
      orderedQuantity: String(orderLine.quantity),
      alreadyInvoicedQuantity: String(alreadyInvoiced),
      invoiceableQuantity: String(invoiceable),
      unitPrice: String(orderLine.unitPriceSnapshot),
      discountRate: String(orderLine.discountPercent ?? 0),
      taxRate: String(orderLine.taxRateSnapshot ?? 0),
    };
  });
}
