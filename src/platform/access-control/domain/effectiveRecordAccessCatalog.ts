export interface EffectiveRecordAccessProfile {
  requestedCommands: readonly string[];
  requestedFields: readonly string[];
  includeExport?: boolean;
  includeApproval?: boolean;
}

export const EFFECTIVE_RECORD_ACCESS_PROFILES = {
  leads: {
    requestedCommands: ["lead.create", "lead.update", "lead.change-work-state", "lead.qualify-opportunity", "lead.qualify-nurture", "lead.disqualify", "lead.record-consent", "lead.merge-duplicates", "lead.confirm-duplicates-distinct", "lead.archive"],
    requestedFields: ["fullName", "phone", "email", "ownerId", "assignedTo", "workState", "qualificationOutcome", "consent", "duplicateResolution"],
    includeExport: true,
    includeApproval: false,
  },
  deals: {
    requestedCommands: ["deal.create", "deal.update", "deal.move-stage", "deal.close-won", "deal.close-lost", "deal.recycle", "deal.delete"],
    requestedFields: ["title", "buyerRef", "ownerId", "stage", "amount", "currency", "probability", "nextAction"],
    includeExport: true,
    includeApproval: true,
  },
  quotes: {
    requestedCommands: ["quote.create", "quote.update", "quote.request-approval", "quote.approve", "quote.reject-approval", "quote.accept", "quote.delete", "quote.export", "order.create"],
    requestedFields: ["title", "buyerRef", "ownerId", "items", "subtotal", "discountAmount", "taxAmount", "grandTotal", "status", "approvalStatus"],
    includeExport: true,
    includeApproval: true,
  },
  orders: {
    requestedCommands: ["order.create", "order.update", "order.confirm", "order.complete", "order.cancel", "order.delete", "order.export", "shipping.create", "payments.record", "invoices.create", "returns.create"],
    requestedFields: ["buyerRef", "customerId", "contactId", "items", "shippingAddress", "paymentAgreement", "grandTotal", "state"],
    includeExport: true,
    includeApproval: true,
  },
  contacts: {
    requestedCommands: ["contact.create", "contact.update", "contact.archive", "contact.delete"],
    requestedFields: ["fullName", "email", "phone", "organizationId", "ownerId", "consentStatus"],
    includeExport: true,
  },
  organizations: {
    requestedCommands: ["organization.create", "organization.update", "organization.archive", "organization.delete"],
    requestedFields: ["name", "legalName", "taxCode", "industry", "ownerId", "status", "primaryContactId"],
    includeExport: true,
  },
  customers: {
    requestedCommands: ["customer.create", "customer.update", "customer.archive"],
    requestedFields: ["displayName", "relationshipRef", "ownerId", "status", "health", "segment"],
    includeExport: true,
  },
  products: {
    requestedCommands: ["product.create", "product.update", "product.archive", "product.delete"],
    requestedFields: ["name", "sku", "type", "price", "currency", "taxClass", "status"],
    includeExport: true,
  },
  returns: {
    requestedCommands: ["return.create", "return.update", "return.approve", "return.reject", "return.receive", "return.inspect", "return.resolve", "return.close"],
    requestedFields: ["orderId", "lines", "status", "resolutionType", "inspection", "refundAmount"],
    includeExport: true,
    includeApproval: true,
  },
  shipping: {
    requestedCommands: ["shipping.create", "shipping.update", "shipping.book", "shipping.sync", "shipping.cancel", "shipping.retry", "shipping.change-provider"],
    requestedFields: ["sourceId", "providerId", "recipient", "status", "externalStatus", "trackingCode", "codAmount"],
    includeExport: true,
  },
  support: {
    requestedCommands: ["support.create", "support.update", "support.assign", "support.resolve", "support.close", "support.reopen", "support.cancel"],
    requestedFields: ["subject", "description", "priority", "status", "assigneeId", "queueId", "slaPolicyId"],
    includeExport: true,
  },
  tasks: {
    requestedCommands: ["task.create", "task.update", "task.assign", "task.complete", "task.reopen", "task.delete"],
    requestedFields: ["title", "description", "assigneeId", "dueAt", "priority", "status", "recordRef"],
    includeExport: true,
  },
} as const satisfies Record<string, EffectiveRecordAccessProfile>;
