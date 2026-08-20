import { MutationCommandError } from "@/shared/application";
import type { ProductionCommandContract } from "./generatedProductionCommandRegistry";

type JsonRecord = Record<string, unknown>;

/**
 * Projects frontend command inputs into the exact OpenAPI request DTO.
 *
 * Connected mode must never serialize demo timestamps, actors, audit records,
 * rollback snapshots, calculated totals or other server-owned evidence merely
 * because they happen to exist on a local command object.
 */
export function projectProductionCommandPayload(
  contract: ProductionCommandContract,
  payload: unknown,
): JsonRecord {
  const input = asRecord(payload, contract.operationId);
  switch (contract.requestProjection) {
    case "INVOICE_DRAFT_CREATE":
      return pick(input, ["buyerRef", "sellerSnapshot", "buyerSnapshot", "currency", "dueDate", "lines", "paymentTerms", "creationIntentId", "sourceLinks"]);
    case "INVOICE_DRAFT_SAVE":
      return pick(input, ["sellerSnapshot", "buyerSnapshot", "dueDate", "lines", "paymentTerms"]);
    case "INVOICE_ISSUE":
      return pick(input, ["expectedVersion"]);
    case "QUOTE_ACCEPT":
      return {};
    case "ORDER_CONFIRM":
      if (input.creditApproval !== undefined) {
        throw blockedVariant(contract.operationId, "creditApproval", "DEC-P02-ORDER-CONFIRMATION-NO-INLINE-CREDIT-OVERRIDE");
      }
      return pick(input, ["paymentAccountId", "creditApprovalId"]);
    case "ORDER_CONVERT_ACCEPTED_QUOTE":
      return { quoteId: requiredString(input.quoteId, contract.operationId, "quoteId") };
    case "ORDER_CREDIT_APPROVAL_REQUEST":
      return {
        orderId: requiredString(input.orderId, contract.operationId, "orderId"),
        reason: requiredString(input.reason, contract.operationId, "reason"),
      };
    case "ORDER_CREDIT_APPROVAL_APPROVE":
    case "ORDER_CREDIT_APPROVAL_REJECT":
      return optionalString(input.decisionNote) ? { decisionNote: optionalString(input.decisionNote) } : {};
    case "ORDER_CREDIT_APPROVAL_REVOKE":
      return { reason: requiredString(input.reason, contract.operationId, "reason") };
    case "ORDER_CANCEL":
      return pick(input, ["reasonCode", "reason"]);
    case "PAYMENT_RECONCILE":
      return pick(input, ["state", "note"]);
    case "PAYMENT_ALLOCATE":
      return projectPaymentAllocation(input, contract.operationId);
    case "PAYMENT_REVERSE_ALLOCATION":
      return {
        reasonCode: requiredString(input.reasonCode, contract.operationId, "reasonCode"),
        reason: requiredString(input.reason, contract.operationId, "reason"),
      };
    case "PAYMENT_REFUND_CREATE":
      return projectRefundIntent(input, contract.operationId);
    case "PAYMENT_REFUND_CANCELLATION_REQUEST":
      return { reasonCode: requiredString(input.reasonCode, contract.operationId, "reasonCode"), reason: requiredString(input.reason, contract.operationId, "reason") };
    case "PAYMENT_REFUND_RETRY_REQUEST":
      return {};
    case "PAYMENT_COD_COLLECTION":
      return projectCodEvidence(input, contract.operationId, ["COLLECTED", "FAILED"]);
    case "PAYMENT_COD_REMITTANCE":
      return projectCodEvidence(input, contract.operationId, ["REMITTED", "FAILED"]);
    case "PAYMENT_INTENT_CREATE":
      return projectPaymentIntentCreate(input, contract.operationId);
    case "PAYMENT_INTENT_CANCEL":
    case "PAYMENT_INTENT_RETRY":
      return {};
    case "RETURN_CREDIT_REFUND_START":
      return {
        amount: requiredMoney(input.amount, contract.operationId, "amount"),
        reasonCode: requiredString(input.reasonCode, contract.operationId, "reasonCode"),
        reason: requiredString(input.reason, contract.operationId, "reason"),
      };
    case "ORDER_CREATE_OUTBOUND_SHIPPING":
      return projectOrderOutboundShipping(input, contract.operationId);
    case "RETURN_BEGIN_PICKUP":
      return { shippingBooking: projectShippingBooking(asRecord(input.shippingBooking, contract.operationId), contract.operationId) };
    case "RETURN_BEGIN_REPLACEMENT":
      return projectReturnReplacement(input, contract.operationId);
    case "RETURN_COMPLETE_REPAIR":
      return {
        reference: requiredString(input.reference, contract.operationId, "reference"),
        ...(optionalString(input.provider) ? { provider: optionalString(input.provider) } : {}),
        result: requiredString(input.result, contract.operationId, "result"),
      };
    case "RETURN_COMPLETE_REPLACEMENT":
      return { shippingIntentId: requiredString(input.shippingIntentId, contract.operationId, "shippingIntentId") };
    case "ORDER_DIRECT_DRAFT_CREATE":
      return projectDirectOrderDraft(input, contract.operationId);
    case "SUPPORT_CREATE":
      return projectSupportCreate(input, contract.operationId);
    case "SUPPORT_ASSIGN":
      return { ownerId: requiredString(asRecord(input.owner, contract.operationId).id, contract.operationId, "owner.id") };
    case "SUPPORT_TRANSITION":
      return {
        nextStatus: requiredString(input.status, contract.operationId, "status"),
        ...(optionalString(input.resolutionSummary) ? { resolutionSummary: optionalString(input.resolutionSummary) } : {}),
        ...(optionalString(input.reason) ? { reason: optionalString(input.reason) } : {}),
      };
    case "SUPPORT_ADD_REPLY":
    case "SUPPORT_ADD_INTERNAL_NOTE":
      return { body: requiredString(input.body, contract.operationId, "body") };
    case "TASK_CREATE":
      return projectTaskCreate(input, contract.operationId);
    case "TASK_COMPLETE":
      return { outcome: requiredString(input.outcome, contract.operationId, "outcome") };
    case "TASK_CANCEL":
    case "TASK_ARCHIVE":
      return { reason: requiredString(input.reason, contract.operationId, "reason") };
    case "TASK_ASSIGN":
      return { assigneeId: requiredString(input.assigneeId, contract.operationId, "assigneeId") };
    case "TASK_RESCHEDULE":
      return { dueAt: requiredString(input.dueAt, contract.operationId, "dueAt") };
    case "TASK_LOG_ACTIVITY":
      return projectActivityCreate(input, contract.operationId);
    default:
      return exhaustiveProjection(contract);
  }
}

function projectOrderOutboundShipping(input: JsonRecord, operationId: string): JsonRecord {
  return {
    providerId: requiredString(input.providerId, operationId, "providerId"),
    ...(optionalString(input.serviceCode) ? { serviceCode: optionalString(input.serviceCode) } : {}),
    pickupLocation: projectShippingLocation(asRecord(input.pickupLocationSnapshot, operationId)),
    ...(input.returnLocationSnapshot === undefined ? {} : { returnLocation: projectShippingLocation(asRecord(input.returnLocationSnapshot, operationId)) }),
    ...(input.recipientSnapshot === undefined ? {} : { recipient: projectShippingRecipient(asRecord(input.recipientSnapshot, operationId), operationId) }),
    package: projectShippingPackage(asRecord(input.packageSnapshot, operationId), operationId),
    ...(optionalString(input.transportMode) ? { transportMode: optionalString(input.transportMode) } : {}),
    ...(optionalString(input.shipmentGroupId) ? { shipmentGroupId: optionalString(input.shipmentGroupId) } : {}),
  };
}

function projectReturnReplacement(input: JsonRecord, operationId: string): JsonRecord {
  const currency = requiredString(input.currency, operationId, "currency");
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw contractFieldViolation(operationId, "lines", "Replacement resolution requires at least one line.");
  }
  return {
    type: requiredString(input.type, operationId, "type"),
    lines: input.lines.map((value, index) => {
      const line = asRecord(value, operationId);
      return {
        productId: requiredString(line.productId, operationId, `lines[${index}].productId`),
        productName: requiredString(line.productNameSnapshot ?? line.productName, operationId, `lines[${index}].productName`),
        quantity: requiredPositiveInteger(line.quantity, operationId, `lines[${index}].quantity`),
      };
    }),
    ...(optionalString(input.commercialAdjustmentNote) ? { commercialAdjustmentNote: optionalString(input.commercialAdjustmentNote) } : {}),
    ...(input.commercialDelta === undefined ? {} : { commercialAdjustment: { amount: decimalString(input.commercialDelta, operationId, "commercialDelta"), currency } }),
    currency,
    shippingBooking: projectShippingBooking(asRecord(input.shippingBooking, operationId), operationId),
  };
}

function projectShippingBooking(input: JsonRecord, operationId: string): JsonRecord {
  return {
    sourceType: requiredString(input.sourceType, operationId, "shippingBooking.sourceType"),
    sourceId: requiredString(input.sourceId, operationId, "shippingBooking.sourceId"),
    purpose: requiredString(input.purpose, operationId, "shippingBooking.purpose"),
    ...(optionalString(input.transportMode) ? { transportMode: optionalString(input.transportMode) } : {}),
    providerId: requiredString(input.providerId, operationId, "shippingBooking.providerId"),
    ...(optionalString(input.serviceCode) ? { serviceCode: optionalString(input.serviceCode) } : {}),
    pickupLocation: projectShippingLocation(asRecord(input.pickupLocationSnapshot, operationId)),
    ...(input.returnLocationSnapshot === undefined ? {} : { returnLocation: projectShippingLocation(asRecord(input.returnLocationSnapshot, operationId)) }),
    recipient: projectShippingRecipient(asRecord(input.recipientSnapshot, operationId), operationId),
    package: projectShippingPackage(asRecord(input.packageSnapshot, operationId), operationId),
    ...(input.codAmount === undefined ? {} : { codAmount: requiredMoney(input.codAmount, operationId, "shippingBooking.codAmount") }),
    shipmentGroupId: requiredString(input.shipmentGroupId, operationId, "shippingBooking.shipmentGroupId"),
  };
}

function projectShippingLocation(input: JsonRecord): JsonRecord {
  return pick(input, ["id", "name", "contactName", "phone", "line1", "line2", "ward", "wardCode", "district", "districtCode", "city", "provinceCode", "country", "countryCode", "postalCode"]);
}

function projectShippingRecipient(input: JsonRecord, operationId: string): JsonRecord {
  return {
    name: requiredString(input.name, operationId, "recipient.name"),
    phone: requiredString(input.phone, operationId, "recipient.phone"),
    ...(optionalString(input.email) ? { email: optionalString(input.email) } : {}),
    address: projectShippingLocation(asRecord(input.address, operationId)),
  };
}

function projectShippingPackage(input: JsonRecord, operationId: string): JsonRecord {
  const result = pick(input, [
    "packageCount", "totalWeightGrams", "lengthCm", "widthCm", "heightCm", "declaredValue",
    "feePayer", "inspectionPolicy", "itemSummary", "note", "pickupNote", "deliveryNote",
    "packageType", "transportMode", "goodsType",
  ]);
  if (Array.isArray(input.lineAllocations)) {
    result.lineAllocations = input.lineAllocations.map((value, index) => {
      const line = asRecord(value, operationId);
      return {
        ...(optionalString(line.orderLineId) ? { orderLineId: optionalString(line.orderLineId) } : {}),
        productId: requiredString(line.productId, operationId, `package.lineAllocations[${index}].productId`),
        ...(optionalString(line.skuSnapshot ?? line.sku) ? { sku: optionalString(line.skuSnapshot ?? line.sku) } : {}),
        productName: requiredString(line.productNameSnapshot ?? line.productName, operationId, `package.lineAllocations[${index}].productName`),
        quantity: requiredPositiveNumber(line.quantity, operationId, `package.lineAllocations[${index}].quantity`),
        ...(line.weightGrams === undefined ? {} : { weightGrams: requiredPositiveNumber(line.weightGrams, operationId, `package.lineAllocations[${index}].weightGrams`) }),
        ...(line.declaredValue === undefined ? {} : { declaredValue: requiredMoney(line.declaredValue, operationId, `package.lineAllocations[${index}].declaredValue`) }),
        ...(optionalString(line.hsCode) ? { hsCode: optionalString(line.hsCode) } : {}),
        ...(optionalString(line.countryOfOrigin) ? { countryOfOrigin: optionalString(line.countryOfOrigin) } : {}),
      };
    });
  }
  return result;
}


function projectDirectOrderDraft(input: JsonRecord, operationId: string): JsonRecord {
  const order = asRecord(input.order, operationId);
  if (optionalString(order.sourceQuoteId)) {
    throw blockedVariant(operationId, "order.sourceQuoteId", "DEC-P07-DIRECT-ORDER-DRAFT");
  }
  const currency = requiredString(order.currency, operationId, "order.currency");
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw contractFieldViolation(operationId, "order.items", "At least one Order line is required.");
  }
  const agreement = order.paymentAgreementSnapshot === undefined
    ? projectHistoricalPaymentAgreement(input.paymentPlan, currency, operationId)
    : projectPaymentAgreement(asRecord(order.paymentAgreementSnapshot, operationId), currency, operationId);
  const result: JsonRecord = {
    buyerRef: asRecord(order.buyerRef, operationId),
    currency,
    items: order.items.map((value, index) => {
      const line = asRecord(value, operationId);
      return {
        productId: requiredString(line.productId, operationId, `order.items[${index}].productId`),
        productName: requiredString(line.productNameSnapshot ?? line.productName ?? line.name, operationId, `order.items[${index}].productName`),
        ...(optionalString(line.skuSnapshot) ? { sku: optionalString(line.skuSnapshot) } : {}),
        ...(optionalString(line.descriptionSnapshot) ? { description: optionalString(line.descriptionSnapshot) } : {}),
        quantity: requiredPositiveNumber(line.quantity, operationId, `order.items[${index}].quantity`),
        unitPrice: { amount: decimalString(line.unitPriceSnapshot, operationId, `order.items[${index}].unitPrice`), currency },
        discountPercent: decimalString(line.discountPercent ?? 0, operationId, `order.items[${index}].discountPercent`),
        taxRate: decimalString(line.taxRateSnapshot ?? 0, operationId, `order.items[${index}].taxRate`),
        taxMode: requiredString(line.taxModeSnapshot ?? "none", operationId, `order.items[${index}].taxMode`),
        fulfillmentKind: requiredString(line.fulfillmentKind ?? "NONE", operationId, `order.items[${index}].fulfillmentKind`),
        ...(optionalString(line.billingCycleSnapshot) ? { billingCycle: optionalString(line.billingCycleSnapshot) } : {}),
      };
    }),
    paymentAgreement: agreement,
  };
  if (Array.isArray(order.adjustments) && order.adjustments.length) {
    result.adjustments = order.adjustments.map((value, index) => {
      const adjustment = asRecord(value, operationId);
      return {
        label: requiredString(adjustment.label, operationId, `order.adjustments[${index}].label`),
        type: requiredString(adjustment.type, operationId, `order.adjustments[${index}].type`),
        calculation: requiredString(adjustment.calculation, operationId, `order.adjustments[${index}].calculation`),
        value: decimalString(adjustment.value, operationId, `order.adjustments[${index}].value`),
      };
    });
  }
  for (const field of ["sourceDealId", "recipientName", "recipientPhone", "recipientEmail", "expectedDeliveryDate", "notes", "internalNotes"] as const) {
    const value = optionalString(order[field]);
    if (value) result[field] = value;
  }
  if (order.shippingAddress !== undefined) result.shippingAddress = asRecord(order.shippingAddress, operationId);
  return result;
}

function projectPaymentAgreement(input: JsonRecord, currency: string, operationId: string): JsonRecord {
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw contractFieldViolation(operationId, "order.paymentAgreementSnapshot.lines", "At least one payment agreement line is required.");
  }
  return {
    kind: requiredString(input.kind, operationId, "order.paymentAgreementSnapshot.kind"),
    currency,
    lines: input.lines.map((value, index) => {
      const line = asRecord(value, operationId);
      return {
        sequence: requiredPositiveInteger(line.sequence ?? index + 1, operationId, `paymentAgreement.lines[${index}].sequence`),
        label: requiredString(line.label, operationId, `paymentAgreement.lines[${index}].label`),
        purpose: requiredString(line.purpose, operationId, `paymentAgreement.lines[${index}].purpose`),
        amountRule: projectAmountRule(line.amountRule, currency, operationId, index),
        dueRule: asRecord(line.dueRule, operationId),
        allowedMethodCodes: requiredStringArray(line.allowedMethodCodes, operationId, `paymentAgreement.lines[${index}].allowedMethodCodes`),
        ...(optionalString(line.preferredMethodCode) ? { preferredMethodCode: optionalString(line.preferredMethodCode) } : {}),
        ...(optionalString(line.channel) ? { channel: optionalString(line.channel) } : {}),
        fulfillmentGate: requiredString(line.fulfillmentGate, operationId, `paymentAgreement.lines[${index}].fulfillmentGate`),
        ...(optionalString(line.invoicePolicyCode) ? { invoicePolicyCode: optionalString(line.invoicePolicyCode) } : {}),
      };
    }),
    ...(optionalString(input.policyVersion) ? { policyVersion: optionalString(input.policyVersion) } : {}),
  };
}

function projectHistoricalPaymentAgreement(value: unknown, currency: string, operationId: string): JsonRecord {
  if (!Array.isArray(value) || value.length === 0) {
    throw contractFieldViolation(operationId, "paymentPlan", "A payment agreement or historical payment-plan input is required.");
  }
  const lines = value.map((entry, index) => {
    const line = asRecord(entry, operationId);
    const method = requiredString(line.method, operationId, `paymentPlan[${index}].method`);
    return {
      sequence: index + 1,
      label: optionalString(line.label) ?? `Payment ${index + 1}`,
      purpose: optionalString(line.purpose) ?? "OTHER",
      amountRule: { type: "FIXED", amount: { amount: decimalString(line.amountDue, operationId, `paymentPlan[${index}].amountDue`), currency } },
      dueRule: optionalString(line.dueDate)
        ? { type: "FIXED_DATE", date: optionalString(line.dueDate) }
        : { type: "EVENT_RELATIVE", event: line.timing === "ON_DELIVERY" ? "DELIVERY_CONFIRMED" : line.timing === "POSTPAID" ? "INVOICE_ISSUED" : "ORDER_CONFIRMED", offsetDays: 0, dayBasis: "CALENDAR" },
      allowedMethodCodes: [method],
      preferredMethodCode: method,
      fulfillmentGate: optionalString(line.fulfillmentGate) ?? "NONE",
      ...(optionalString(line.purpose) === "DEPOSIT" ? { invoicePolicyCode: "DEPOSIT_INVOICE_ALLOWED" } : { invoicePolicyCode: "STANDARD_ORDER_INVOICE" }),
    };
  });
  const first = asRecord(value[0], operationId);
  return {
    kind: optionalString(first.planType) ?? (value.length > 1 ? "INSTALLMENT" : "FULL_PAYMENT"),
    currency,
    lines,
    policyVersion: "order-draft-payment-agreement/v2",
  };
}

function projectAmountRule(value: unknown, currency: string, operationId: string, index: number): JsonRecord {
  const rule = asRecord(value, operationId);
  const type = requiredString(rule.type, operationId, `paymentAgreement.lines[${index}].amountRule.type`);
  if (type === "FIXED") return { type, amount: requiredMoneyWithCurrency(rule.amount, currency, operationId, `paymentAgreement.lines[${index}].amountRule.amount`) };
  if (type === "PERCENTAGE") return { type, percentage: decimalString(rule.percentage, operationId, `paymentAgreement.lines[${index}].amountRule.percentage`) };
  if (type === "REMAINDER") return { type };
  throw contractFieldViolation(operationId, `paymentAgreement.lines[${index}].amountRule.type`, "Unsupported payment amount rule.");
}

function projectSupportCreate(input: JsonRecord, operationId: string): JsonRecord {
  const allowedCategories = new Set(["request", "consultation", "complaint", "follow_up", "onboarding", "usage_issue", "post_purchase"]);
  const category = requiredString(input.category, operationId, "category");
  if (!allowedCategories.has(category)) throw contractFieldViolation(operationId, "category", "Retired Support category values are read-only and cannot be authored.");
  return {
    title: requiredString(input.title, operationId, "title"),
    description: requiredString(input.description, operationId, "description"),
    priority: requiredString(input.priority, operationId, "priority"),
    category,
    source: requiredString(input.source, operationId, "source"),
    ...(optionalString(input.channel) ? { channel: optionalString(input.channel) } : {}),
    relationshipRef: asRecord(input.relationshipRef, operationId),
    ...(optionalString(input.contactId) ? { contactId: optionalString(input.contactId) } : {}),
    ...(optionalString(input.relatedOrderId) ? { relatedOrderId: optionalString(input.relatedOrderId) } : {}),
    ...(optionalString(input.relatedProductId) ? { relatedProductId: optionalString(input.relatedProductId) } : {}),
    ...(optionalString(input.relatedOwnedProductId) ? { relatedOwnedProductId: optionalString(input.relatedOwnedProductId) } : {}),
    ...(optionalString(input.nextFollowUpAt) ? { nextFollowUpAt: optionalString(input.nextFollowUpAt) } : {}),
    ...(Array.isArray(input.tags) ? { tags: input.tags } : {}),
  };
}

function projectTaskCreate(input: JsonRecord, operationId: string): JsonRecord {
  return {
    title: requiredString(input.title, operationId, "title"),
    ...(optionalString(input.description) ? { description: optionalString(input.description) } : {}),
    ...(optionalString(input.priority) ? { priority: optionalString(input.priority) } : {}),
    assigneeId: requiredString(input.assigneeId, operationId, "assigneeId"),
    dueAt: requiredString(input.dueAt, operationId, "dueAt"),
    ...(input.relationshipRef === undefined ? {} : { relationshipRef: asRecord(input.relationshipRef, operationId) }),
    ...(input.recordRef === undefined ? {} : { recordRef: asRecord(input.recordRef, operationId) }),
    ...(input.sourceRef === undefined ? {} : { sourceRef: asRecord(input.sourceRef, operationId) }),
    ...(optionalString(input.dedupeKey) ? { dedupeKey: optionalString(input.dedupeKey) } : {}),
  };
}

function projectActivityCreate(input: JsonRecord, operationId: string): JsonRecord {
  return {
    type: requiredString(input.type, operationId, "type"),
    subject: requiredString(input.subject, operationId, "subject"),
    ...(optionalString(input.body) ? { body: optionalString(input.body) } : {}),
    ...(input.relationshipRef === undefined ? {} : { relationshipRef: asRecord(input.relationshipRef, operationId) }),
    ...(input.recordRef === undefined ? {} : { recordRef: asRecord(input.recordRef, operationId) }),
    ...(input.sourceRef === undefined ? {} : { sourceRef: asRecord(input.sourceRef, operationId) }),
  };
}

function requiredMoneyWithCurrency(value: unknown, currency: string, operationId: string, field: string): JsonRecord {
  const amount = asRecord(value, operationId);
  const actualCurrency = requiredString(amount.currency, operationId, `${field}.currency`);
  if (actualCurrency !== currency) throw contractFieldViolation(operationId, `${field}.currency`, "Payment agreement currency must match Order currency.");
  return { amount: requiredString(amount.amount, operationId, `${field}.amount`), currency: actualCurrency };
}

function decimalString(value: unknown, operationId: string, field: string): string {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "" || !/^-?[0-9]+(?:\.[0-9]+)?$/.test(String(value))) {
    throw contractFieldViolation(operationId, field, "A canonical decimal value is required.");
  }
  return String(value);
}

function requiredPositiveNumber(value: unknown, operationId: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw contractFieldViolation(operationId, field, "A positive finite number is required.");
  return value;
}

function requiredPositiveInteger(value: unknown, operationId: string, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw contractFieldViolation(operationId, field, "A positive integer is required.");
  return value;
}

function requiredStringArray(value: unknown, operationId: string, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => !optionalString(entry))) {
    throw contractFieldViolation(operationId, field, "At least one non-empty string is required.");
  }
  return value.map((entry) => String(entry).trim());
}

function projectPaymentIntentCreate(input: JsonRecord, operationId: string): JsonRecord {
  const returnContext = asRecord(input.returnContext, operationId);
  return {
    buyerRef: asRecord(input.buyerRef, operationId),
    ...(optionalString(input.orderId) ? { orderId: optionalString(input.orderId) } : {}),
    ...(Array.isArray(input.invoiceIds) && input.invoiceIds.length ? { invoiceIds: input.invoiceIds } : {}),
    ...(Array.isArray(input.scheduleLineIds) && input.scheduleLineIds.length ? { scheduleLineIds: input.scheduleLineIds } : {}),
    amount: requiredMoney(input.amount, operationId, "amount"),
    methodCode: requiredString(input.methodCode, operationId, "methodCode"),
    providerCode: requiredString(input.providerCode, operationId, "providerCode"),
    returnRouteKey: requiredString(returnContext.routeKey, operationId, "returnContext.routeKey"),
  };
}

function projectPaymentAllocation(input: JsonRecord, operationId: string): JsonRecord {
  const paymentRecordId = optionalString(input.paymentRecordId);
  const customerCreditId = optionalString(input.customerCreditId);
  if (Boolean(paymentRecordId) === Boolean(customerCreditId)) {
    throw contractFieldViolation(operationId, "source", "Exactly one paymentRecordId or customerCreditId is required.");
  }
  if (!Array.isArray(input.allocations) || input.allocations.length === 0) {
    throw contractFieldViolation(operationId, "targets", "At least one allocation target is required.");
  }
  return {
    source: { type: paymentRecordId ? "PAYMENT_RECORD" : "CUSTOMER_CREDIT", id: paymentRecordId ?? customerCreditId },
    targets: input.allocations.map((item, index) => {
      const allocation = asRecord(item, operationId);
      const invoice = asRecord(allocation.invoice, operationId);
      return {
        invoiceId: requiredString(invoice.invoiceId, operationId, `targets[${index}].invoiceId`),
        amount: requiredMoney(allocation.amount, operationId, `targets[${index}].amount`),
        ...(optionalString(allocation.scheduleLineId) === undefined ? {} : { scheduleLineId: optionalString(allocation.scheduleLineId) }),
      };
    }),
  };
}

function projectRefundIntent(input: JsonRecord, operationId: string): JsonRecord {
  const paymentRecordId = optionalString(input.paymentRecordId);
  const customerCreditId = optionalString(input.customerCreditId);
  if (Boolean(paymentRecordId) === Boolean(customerCreditId)) {
    throw contractFieldViolation(operationId, "source", "Exactly one paymentRecordId or customerCreditId is required.");
  }
  return {
    source: { type: paymentRecordId ? "PAYMENT_RECORD" : "CUSTOMER_CREDIT", id: paymentRecordId ?? customerCreditId },
    amount: requiredMoney(input.amount, operationId, "amount"),
    reasonCode: requiredString(input.reasonCode, operationId, "reasonCode"),
    reason: requiredString(input.reason, operationId, "reason"),
    ...(optionalString(input.sourceReturnId) === undefined ? {} : { sourceReturnId: optionalString(input.sourceReturnId) }),
  };
}

function projectCodEvidence(input: JsonRecord, operationId: string, allowed: readonly string[]): JsonRecord {
  const outcome = requiredString(input.state, operationId, "state");
  if (!allowed.includes(outcome)) throw contractFieldViolation(operationId, "state", `Allowed values: ${allowed.join(", ")}.`);
  const metadata = input.evidenceMetadata === undefined ? {} : asRecord(input.evidenceMetadata, operationId);
  const evidenceReference = optionalString(metadata.evidenceReference)
    ?? optionalString(metadata.customerCollectionEvidenceId)
    ?? optionalString(metadata.merchantRemittanceEvidenceId)
    ?? optionalString(metadata.providerEvidenceId);
  if (!evidenceReference) throw contractFieldViolation(operationId, "evidenceReference", "Authoritative provider/carrier evidence reference is required.");
  return {
    outcome,
    evidenceReference,
    ...(optionalString(metadata.providerReference) === undefined ? {} : { providerReference: optionalString(metadata.providerReference) }),
    ...(optionalString(metadata.note) === undefined ? {} : { note: optionalString(metadata.note) }),
  };
}

function requiredMoney(value: unknown, operationId: string, field: string): JsonRecord {
  const amount = asRecord(value, operationId);
  return {
    amount: requiredString(amount.amount, operationId, `${field}.amount`),
    currency: requiredString(amount.currency, operationId, `${field}.currency`),
  };
}

function requiredString(value: unknown, operationId: string, field: string): string {
  const normalized = optionalString(value);
  if (!normalized) throw contractFieldViolation(operationId, field, "A non-empty string is required.");
  return normalized;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function contractFieldViolation(operationId: string, field: string, message: string): MutationCommandError {
  return new MutationCommandError({
    code: "CONNECTED_CONTRACT_VIOLATION",
    message: `${operationId}: ${message}`,
    category: "VALIDATION",
    retryable: false,
    details: { operationId, field, authority: "docs/api/openapi.json" },
  });
}

function asRecord(value: unknown, operationId: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MutationCommandError({
      code: "CONNECTED_CONTRACT_VIOLATION",
      message: `${operationId} requires an object request payload.`,
      category: "INFRASTRUCTURE",
      retryable: false,
      details: { operationId, field: "requestBody", authority: "docs/api/openapi.json" },
    });
  }
  return value as JsonRecord;
}

function pick(input: JsonRecord, fields: readonly string[]): JsonRecord {
  return Object.fromEntries(fields.flatMap((field) => input[field] === undefined ? [] : [[field, input[field]]]));
}

function blockedVariant(operationId: string, field: string, decisionId: string): MutationCommandError {
  return new MutationCommandError({
    code: "CONNECTED_COMMAND_VARIANT_BLOCKED",
    message: `${operationId} does not accept frontend-authored ${field}.`,
    category: "BUSINESS_RULE",
    retryable: false,
    details: { operationId, field, decisionId, authority: "docs/backend-readiness/p02-transaction-semantics.json" },
  });
}

function exhaustiveProjection(contract: ProductionCommandContract): never {
  throw new MutationCommandError({
    code: "CONNECTED_CONTRACT_VIOLATION",
    message: "Production command request projection is not implemented.",
    category: "INFRASTRUCTURE",
    retryable: false,
    details: { contract },
  });
}
