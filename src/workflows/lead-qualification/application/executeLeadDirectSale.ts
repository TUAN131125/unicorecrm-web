import { LeadWorkState, QualificationOutcome } from "@/modules/leads";
import { QuoteStatus } from "@/modules/quotes";
import { relationshipRefKey } from "@/platform/identity";
import { validateDirectSaleReadiness } from "../domain/leadQualification.rules";
import type { ExecuteLeadDirectSaleCommand, LeadQualificationResult } from "../domain/leadQualification.types";
import type { LeadQualificationPorts } from "./ports/LeadQualificationPorts";

function calculateLine(item: ExecuteLeadDirectSaleCommand["lineItems"][number]) {
  const subtotal = item.quantity * item.unitPrice;
  const taxRate = item.taxRate ?? 0;
  const taxAmount = item.taxMode === "none" ? 0 : subtotal * taxRate / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

export function executeLeadDirectSale(
  command: ExecuteLeadDirectSaleCommand,
  ports: LeadQualificationPorts,
): LeadQualificationResult {
  const lead = ports.leads.getById(command.leadId);
  if (!lead) throw new Error(`Lead not found: ${command.leadId}`);
  if (lead.leadWorkState !== LeadWorkState.VERIFYING) throw new Error("Lead must be VERIFYING before qualification can be closed.");
  const errors = validateDirectSaleReadiness(command);
  if (errors.length > 0) throw new Error(errors.join(" "));

  const now = command.now ?? new Date();
  const nowIso = now.toISOString();
  const dateOnly = nowIso.split("T")[0];
  const seed = command.idSeed ?? String(now.getTime());
  const relationship = ports.relationships.resolve(lead, command.relationship, { nowIso, seed });

  let quoteId: string | undefined;
  let orderId: string | undefined;

  if (command.path === "QUOTE") {
    quoteId = `quote_${seed}`;
    const lineItems = command.lineItems.map((item, index) => {
      const amount = calculateLine(item);
      return {
        id: `qi_${quoteId}_${index}`,
        productId: item.productId,
        skuSnapshot: item.sku,
        productNameSnapshot: item.name,
        productTypeSnapshot: item.productType,
        descriptionSnapshot: item.description,
        quantity: item.quantity,
        unitPriceSnapshot: item.unitPrice,
        discountPercent: 0,
        taxRateSnapshot: item.taxRate ?? 0,
        taxModeSnapshot: item.taxMode ?? "none",
        billingCycleSnapshot: item.billingCycle,
        lineSubtotal: amount.subtotal,
        lineDiscountAmount: 0,
        lineTaxAmount: amount.taxAmount,
        lineTotal: amount.total,
      };
    });
    ports.quotes.create({
      id: quoteId,
      quoteNumber: `QT-${seed.slice(-6)}`,
      version: 1,
      rootQuoteId: quoteId,
      buyerRef: relationship.relationshipRef,
      sourcePath: "DIRECT_SALE",
      contactId: relationship.contactId,
      customerName: relationship.organizationName || relationship.contactName || relationship.displayName,
      customerAddress: relationship.organizationAddress || relationship.contactAddress || "",
      customerContact: relationship.contactName,
      recipientEmail: relationship.contactEmail,
      leadId: lead.id,
      sourceLeadId: lead.id,
      leadName: lead.name,
      status: QuoteStatus.DRAFT,
      title: command.title?.trim() || `Direct Sale proposal for ${relationship.displayName}`,
      lineItems,
      subtotal: lineItems.reduce((sum, item) => sum + (item.lineSubtotal ?? 0), 0),
      discountTotal: 0,
      taxTotal: lineItems.reduce((sum, item) => sum + (item.lineTaxAmount ?? 0), 0),
      grandTotal: lineItems.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0),
      createdAt: nowIso,
      validUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    });
  } else {
    orderId = `order_${seed}`;
    const items = command.lineItems.map((item, index) => {
      const amount = calculateLine(item);
      return {
        id: `oi_${orderId}_${index}`,
        productId: item.productId,
        skuSnapshot: item.sku,
        productNameSnapshot: item.name,
        productTypeSnapshot: item.productType,
        descriptionSnapshot: item.description,
        quantity: item.quantity,
        unitPriceSnapshot: item.unitPrice,
        discountPercent: 0,
        taxRateSnapshot: item.taxRate ?? 0,
        taxModeSnapshot: item.taxMode ?? "none",
        billingCycleSnapshot: item.billingCycle,
        lineSubtotal: amount.subtotal,
        lineDiscountAmount: 0,
        lineTaxAmount: amount.taxAmount,
        lineTotal: amount.total,
      };
    });
    ports.orders.create({
      id: orderId,
      orderNumber: `ORD-${seed.slice(-6)}`,
      orderDate: dateOnly,
      buyerRef: relationship.relationshipRef,
      contactId: relationship.contactId,
      contactName: relationship.contactName,
      customerName: relationship.organizationName || relationship.contactName || relationship.displayName,
      recipientName: relationship.contactName,
      recipientPhone: relationship.contactPhone,
      recipientEmail: relationship.contactEmail,
      sourceLeadId: lead.id,
      state: "DRAFT",
      items,
      subtotal: items.reduce((sum, item) => sum + item.lineSubtotal, 0),
      discountTotal: 0,
      taxTotal: items.reduce((sum, item) => sum + item.lineTaxAmount, 0),
      grandTotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
      totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
      ownerId: command.ownerId || lead.ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    }, relationshipRefKey(relationship.relationshipRef));
  }

  ports.leads.close(lead.id, {
    outcome: QualificationOutcome.DIRECT_SALE,
    relationshipRef: relationship.relationshipRef,
    activity: {
      id: `act_direct_sale_${seed}`,
      type: "system",
      title: "Lead closed: Direct Sale",
      description: `${command.path === "QUOTE" ? `Quote ${quoteId}` : `Order ${orderId}`} created for ${relationship.displayName}. No Deal was created.`,
      createdAt: nowIso,
      author: "Qualification Workflow",
    },
  });

  return {
    leadId: lead.id,
    relationshipRef: relationship.relationshipRef,
    contactId: relationship.contactId,
    organizationAccountId: relationship.organizationAccountId,
    quoteId,
    orderId,
  };
}
