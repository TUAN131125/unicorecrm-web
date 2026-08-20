import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability, assertRuntimeWorkspaceAccess } from "@/platform/access-control";
import { recordOperationalAudit } from "@/platform/operational-audit";
import type { BuyerRef } from "@/platform/identity";
import type { ReturnRepository } from "../ports/ReturnRepository";
import type { RequestedReturnResolution, ReturnEligibilityResult, ReturnItem, ReturnMethod, ReturnReason, ReturnRequest, ReturnResolution, ReturnResolutionIntent, ReturnStatus } from "../../domain/model/return.types";
import { canTransitionReturn } from "../../domain/rules/returnLifecycle";
import { compareMoney, money, type MoneyDto } from "@/shared/money";
import { createDurableId } from "@/shared/ids";

interface ActorInput { actorId: string; actorName?: string; now?: string; correlationId?: string; }
export interface CreateReturnRequestCommand extends ActorInput {
  id: string;
  workspaceId: string;
  code: string;
  orderId: string;
  buyerRef: BuyerRef;
  ownerId: string;
  items: ReturnItem[];
  reason: ReturnReason;
  requestedResolution: RequestedReturnResolution;
  note?: string;
  deliveredAt?: string;
  deliveryEvidenceShippingBookingId?: string;
  manualDeliveryEvidence?: { deliveredAt: string; reason: string; evidenceRef: string };
  returnWindowDays?: number;
}

function priorAcceptedQty(repository: ReturnRepository, orderId: string, lineId: string): number {
  return repository.listRequests().filter((request) => request.orderId === orderId && request.status !== "REJECTED").flatMap((request) => request.items).filter((item) => item.orderLineId === lineId).reduce((sum, item) => sum + (item.acceptedQuantity ?? 0), 0);
}

export function evaluateReturnEligibility(repository: ReturnRepository, command: CreateReturnRequestCommand, now: string): ReturnEligibilityResult {
  const deliveredAtValue = command.deliveredAt ?? command.manualDeliveryEvidence?.deliveredAt;
  if (!deliveredAtValue) return { eligible: false, reasonCode: "MISSING_DELIVERY_EVIDENCE", explanation: "Không tìm thấy deliveredAt từ Shipping hoặc manual evidence đã audit.", evaluatedAt: now };
  const deliveredAt = new Date(deliveredAtValue);
  if (Number.isNaN(deliveredAt.getTime())) return { eligible: false, reasonCode: "INVALID_DELIVERY_EVIDENCE", explanation: "deliveredAt không hợp lệ.", evaluatedAt: now };
  const windowDays = command.returnWindowDays ?? 30;
  if (new Date(now).getTime() - deliveredAt.getTime() > windowDays * 86400000) return { eligible: false, reasonCode: "RETURN_WINDOW_EXPIRED", explanation: `Đã quá thời hạn đổi/trả ${windowDays} ngày.`, evaluatedAt: now };
  for (const item of command.items) {
    const prior = priorAcceptedQty(repository, command.orderId, item.orderLineId);
    if (item.requestedQuantity <= 0) return { eligible: false, reasonCode: "INVALID_QUANTITY", explanation: "Số lượng đổi/trả phải lớn hơn 0.", evaluatedAt: now };
    if (item.requestedQuantity > item.orderedQuantity - prior) return { eligible: false, reasonCode: "QUANTITY_EXCEEDS_REMAINING", explanation: `${item.productNameSnapshot}: requestedQuantity vượt quá số lượng còn có thể đổi/trả.`, evaluatedAt: now };
  }
  return { eligible: true, reasonCode: "ELIGIBLE", explanation: "Yêu cầu đáp ứng các điều kiện tự động; doanh nghiệp vẫn phải duyệt riêng.", evaluatedAt: now };
}

export function createReturnRequest(repository: ReturnRepository, command: CreateReturnRequestCommand): ReturnRequest {
  assertRuntimeWorkspaceAccess(command.workspaceId);
  assertRuntimeCapability(CAPABILITIES.RETURNS_CREATE);
  if (!command.orderId) throw new Error("Return bắt buộc tham chiếu Order.");
  if (!command.buyerRef?.id) throw new Error("Return requires buyerRef.");
  if (!command.items.length) throw new Error("Return phải có ít nhất một order line.");
  if (Boolean(command.deliveredAt) !== Boolean(command.deliveryEvidenceShippingBookingId)) throw new Error("Shipping delivery evidence requires both deliveredAt and booking reference.");
  if (command.manualDeliveryEvidence && (command.deliveredAt || command.deliveryEvidenceShippingBookingId)) throw new Error("Use either Shipping delivery evidence or manual delivery evidence, not both.");
  if (command.manualDeliveryEvidence) {
    if (Number.isNaN(new Date(command.manualDeliveryEvidence.deliveredAt).getTime())) throw new Error("Manual delivery evidence requires a valid deliveredAt.");
    if (!command.manualDeliveryEvidence.reason.trim()) throw new Error("Manual delivery evidence requires a reason.");
    if (!command.manualDeliveryEvidence.evidenceRef.trim()) throw new Error("Manual delivery evidence requires an evidence reference.");
  }
  const duplicateLines = command.items.filter((item, index) => command.items.findIndex((candidate) => candidate.orderLineId === item.orderLineId) !== index);
  if (duplicateLines.length) throw new Error("Return request cannot contain duplicate Order lines.");
  const now = command.now ?? new Date().toISOString();
  const eligibilityResult = evaluateReturnEligibility(repository, command, now);
  const deliveredAt = command.deliveredAt ?? command.manualDeliveryEvidence?.deliveredAt;
  const request: ReturnRequest = {
    id: command.id, workspaceId: command.workspaceId, code: command.code, orderId: command.orderId, buyerRef: command.buyerRef, ownerId: command.ownerId,
    items: command.items.map((item) => ({ ...item, previouslyAcceptedReturnQuantity: priorAcceptedQty(repository, command.orderId, item.orderLineId) })),
    reason: command.reason, requestedResolution: command.requestedResolution, note: command.note?.trim() || undefined, status: "REQUESTED", deliveredAt,
    deliveryEvidenceShippingBookingId: command.deliveryEvidenceShippingBookingId,
    manualDeliveryEvidence: command.manualDeliveryEvidence ? { ...command.manualDeliveryEvidence, reason: command.manualDeliveryEvidence.reason.trim(), evidenceRef: command.manualDeliveryEvidence.evidenceRef.trim(), source: "MANUAL", actorId: command.actorId, actorName: command.actorName, createdAt: now } : undefined,
    requestedAt: now, eligibilityResult, correlationId: command.correlationId ?? `return:${command.id}`, createdAt: now, updatedAt: now, version: 1,
  };
  const saved = repository.saveRequest(request);
  recordOperationalAudit({ moduleKey: "returns", recordId: saved.id, action: "ReturnRequested", actorId: command.actorId, actorName: command.actorName, correlationId: saved.correlationId, after: saved });
  return saved;
}

function transition(repository: ReturnRepository, returnId: string, next: ReturnStatus, input: ActorInput, capability: string = CAPABILITIES.RETURNS_UPDATE, patch: Partial<ReturnRequest> = {}): ReturnRequest {
  const current = repository.findById(returnId); if (!current) throw new Error(`Return ${returnId} not found.`);
  assertRuntimeCommandAccess(capability, "returns", current);
  if (!canTransitionReturn(current.status, next)) throw new Error(`Return cannot transition from ${current.status} to ${next}.`);
  const now = input.now ?? new Date().toISOString();
  const saved = repository.saveRequest({ ...current, ...patch, status: next, updatedAt: now, version: current.version + 1 });
  recordOperationalAudit({ moduleKey: "returns", recordId: saved.id, action: `Return${next[0]}${next.slice(1).toLowerCase()}`, actorId: input.actorId, actorName: input.actorName, correlationId: input.correlationId ?? saved.correlationId, before: current, after: saved });
  return saved;
}

export function approveReturn(repository: ReturnRepository, returnId: string, input: ActorInput & { reason: string; overrideReason?: string; items?: Array<{ orderLineId: string; approvedQuantity: number; approvalReason?: string }> }): ReturnRequest {
  if (!input.reason.trim()) throw new Error("Approval requires a decision reason.");
  const current = repository.findById(returnId); if (!current) throw new Error(`Return ${returnId} not found.`);
  if (!current.eligibilityResult.eligible && !input.overrideReason?.trim()) throw new Error("Ineligible Return requires an explicit override reason.");
  const items = current.items.map((item) => {
    const decision = input.items?.find((row) => row.orderLineId === item.orderLineId);
    const approvedQuantity = decision?.approvedQuantity ?? item.requestedQuantity;
    if (approvedQuantity < 0 || approvedQuantity > item.requestedQuantity) throw new Error(`Approved quantity is invalid for line ${item.orderLineId}.`);
    return { ...item, approvedQuantity, approvalReason: decision?.approvalReason };
  });
  if (!items.some((item) => (item.approvedQuantity ?? 0) > 0)) throw new Error("Approval must approve at least one unit.");
  return transition(repository, returnId, "APPROVED", input, CAPABILITIES.RETURNS_APPROVE, { items, decision: { outcome: "APPROVED", reason: input.reason.trim(), decidedAt: input.now ?? new Date().toISOString(), decidedBy: input.actorId, override: !current.eligibilityResult.eligible, overrideReason: input.overrideReason?.trim() } });
}

export function rejectReturn(repository: ReturnRepository, returnId: string, input: ActorInput & { reason: string }): ReturnRequest {
  if (!input.reason.trim()) throw new Error("Rejection requires a reason.");
  return transition(repository, returnId, "REJECTED", input, CAPABILITIES.RETURNS_APPROVE, { decision: { outcome: "REJECTED", reason: input.reason.trim(), decidedAt: input.now ?? new Date().toISOString(), decidedBy: input.actorId } });
}

export function configureReturnMethod(repository: ReturnRepository, returnId: string, input: ActorInput & { method: ReturnMethod; shippingBookingId?: string; carrier?: string; trackingCode?: string; dropOffLocation?: string; returnByDate?: string }): ReturnRequest {
  const current = repository.findById(returnId); if (!current) throw new Error(`Return ${returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_UPDATE, "returns", current);
  if (current.status !== "APPROVED") throw new Error("Return method can be configured only after approval.");
  if (input.method === "CARRIER_PICKUP" && !input.shippingBookingId) throw new Error("Carrier pickup requires a Shipping booking reference.");
  if (input.method === "CUSTOMER_SELF_SHIP" && (!input.carrier?.trim() || !input.trackingCode?.trim())) throw new Error("Customer self-ship requires carrier and tracking code.");
  if (input.method === "DROP_OFF" && !input.dropOffLocation?.trim()) throw new Error("Drop-off requires a location.");
  const patch = { returnMethod: { method: input.method, configuredAt: input.now ?? new Date().toISOString(), configuredBy: input.actorId, carrier: input.carrier?.trim(), trackingCode: input.trackingCode?.trim(), dropOffLocation: input.dropOffLocation?.trim(), returnByDate: input.returnByDate }, returnPickupShippingBookingId: input.shippingBookingId };
  if (input.method === "NO_PHYSICAL_RETURN") return transition(repository, returnId, "RECEIVED", input, CAPABILITIES.RETURNS_UPDATE, { ...patch, receivedAt: input.now ?? new Date().toISOString(), receivedBy: input.actorId, receiveConditionNote: "Physical return waived by policy", items: current.items.map((item) => ({ ...item, receivedQuantity: 0, acceptedQuantity: item.approvedQuantity ?? item.requestedQuantity, rejectedQuantity: 0, inspectionNote: "No physical return required" })), inspection: { inspectedAt: input.now ?? new Date().toISOString(), inspectedBy: input.actorId, note: "Physical return waived by policy" } });
  return transition(repository, returnId, "AWAITING_ITEM", input, CAPABILITIES.RETURNS_UPDATE, patch);
}

export function markReturnAwaitingItem(repository: ReturnRepository, returnId: string, input: ActorInput & { shippingBookingId: string }): ReturnRequest {
  return configureReturnMethod(repository, returnId, { ...input, method: "CARRIER_PICKUP" });
}

export function confirmReturnedItemsReceived(repository: ReturnRepository, returnId: string, input: ActorInput & { items: Array<{ orderLineId: string; receivedQuantity: number; acceptedQuantity?: number; rejectedQuantity?: number; condition?: string; disposition?: ReturnItem["disposition"]; inspectionNote?: string; evidenceRefs?: string[] }>; conditionNote: string }): ReturnRequest {
  const current = repository.findById(returnId); if (!current) throw new Error(`Return ${returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_UPDATE, "returns", current);
  if (!["APPROVED", "AWAITING_ITEM"].includes(current.status)) throw new Error("Return must be APPROVED or AWAITING_ITEM before receive confirmation.");
  if (!input.conditionNote.trim()) throw new Error("Receive condition note is required.");
  const items = current.items.map((item) => {
    const received = input.items.find((row) => row.orderLineId === item.orderLineId);
    if (!received) throw new Error(`Missing receive confirmation for line ${item.orderLineId}.`);
    const approvedQuantity = item.approvedQuantity ?? item.requestedQuantity;
    if (!Number.isFinite(received.receivedQuantity) || received.receivedQuantity < 0 || received.receivedQuantity > approvedQuantity) throw new Error("Received quantity is invalid.");
    const acceptedQuantity = received.acceptedQuantity;
    const rejectedQuantity = received.rejectedQuantity;
    if ((acceptedQuantity !== undefined || rejectedQuantity !== undefined)) {
      if ((acceptedQuantity ?? 0) < 0 || (rejectedQuantity ?? 0) < 0) throw new Error("Accepted and rejected quantities cannot be negative.");
      if ((acceptedQuantity ?? 0) + (rejectedQuantity ?? 0) !== received.receivedQuantity) throw new Error("Accepted + rejected quantity must equal received quantity.");
    }
    return { ...item, ...received, acceptedQuantity, rejectedQuantity };
  });
  const totalReceived = items.reduce((sum, item) => sum + (item.receivedQuantity ?? 0), 0);
  if (totalReceived <= 0) throw new Error("Receive confirmation must include at least one received unit.");
  const fullyReceived = items.every((item) => (item.receivedQuantity ?? 0) >= (item.approvedQuantity ?? item.requestedQuantity));
  const inspectionComplete = items.every((item) => item.acceptedQuantity !== undefined && item.rejectedQuantity !== undefined);
  const now = input.now ?? new Date().toISOString();
  const patch: Partial<ReturnRequest> = { items, receivedAt: now, receivedBy: input.actorId, receiveConditionNote: input.conditionNote.trim(), inspection: inspectionComplete ? { inspectedAt: now, inspectedBy: input.actorId, note: input.conditionNote.trim() } : undefined };
  if (fullyReceived) return transition(repository, returnId, "RECEIVED", input, CAPABILITIES.RETURNS_UPDATE, patch);
  const saved = repository.saveRequest({ ...current, ...patch, updatedAt: now, version: current.version + 1 });
  recordOperationalAudit({ moduleKey: "returns", recordId: saved.id, action: "ReturnPartiallyReceived", actorId: input.actorId, actorName: input.actorName, correlationId: saved.correlationId, before: current, after: saved });
  return saved;
}

export function inspectReturnedItems(repository: ReturnRepository, returnId: string, input: ActorInput & { items: Array<{ orderLineId: string; acceptedQuantity: number; rejectedQuantity: number; condition?: string; disposition?: ReturnItem["disposition"]; inspectionNote?: string; evidenceRefs?: string[] }>; note: string }): ReturnRequest {
  const current = repository.findById(returnId); if (!current) throw new Error(`Return ${returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_UPDATE, "returns", current);
  if (current.status !== "RECEIVED") throw new Error("Inspection requires Return RECEIVED.");
  if (!input.note.trim()) throw new Error("Inspection note is required.");
  const items = current.items.map((item) => {
    const inspection = input.items.find((row) => row.orderLineId === item.orderLineId);
    if (!inspection) throw new Error(`Missing inspection for line ${item.orderLineId}.`);
    const receivedQuantity = item.receivedQuantity ?? 0;
    if (inspection.acceptedQuantity < 0 || inspection.rejectedQuantity < 0 || inspection.acceptedQuantity + inspection.rejectedQuantity !== receivedQuantity) throw new Error("Inspection quantities must be non-negative and equal received quantity.");
    return { ...item, ...inspection };
  });
  const now = input.now ?? new Date().toISOString();
  const saved = repository.saveRequest({ ...current, items, inspection: { inspectedAt: now, inspectedBy: input.actorId, note: input.note.trim() }, updatedAt: now, version: current.version + 1 });
  recordOperationalAudit({ moduleKey: "returns", recordId: saved.id, action: "ReturnInspected", actorId: input.actorId, actorName: input.actorName, correlationId: saved.correlationId, before: current, after: saved });
  return saved;
}

function saveIntent(repository: ReturnRepository, request: ReturnRequest, target: ReturnResolutionIntent["target"], action: ReturnResolutionIntent["action"], payload: Record<string, unknown>, now: string): ReturnResolutionIntent {
  const key = `return:${request.id}:${action}`;
  const existing = repository.findIntentByIdempotencyKey(key);
  if (existing && existing.status !== "FAILED") return existing;
  if (!request.workspaceId || !request.correlationId) throw new Error("Return resolution requires workspace and correlation evidence.");
  return repository.saveIntent({ id: createDurableId("return_intent"), workspaceId: request.workspaceId, returnId: request.id, target, action, payload, status: "PENDING", idempotencyKey: `${key}:${existing ? "retry" : "initial"}`, correlationId: request.correlationId, createdAt: now });
}

function assertResolutionReady(current: ReturnRequest): void {
  if (current.status !== "RECEIVED") throw new Error("Resolution requires Return RECEIVED.");
  if (!current.inspection) throw new Error("Return must be inspected before resolution.");
}

export function requestRefundResolution(repository: ReturnRepository, returnId: string, input: ActorInput & { amount: MoneyDto }): { request: ReturnRequest; intent: ReturnResolutionIntent } {
  const current = repository.findById(returnId); if (!current) throw new Error(`Return ${returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_RESOLVE, "returns", current); assertResolutionReady(current);
  if (compareMoney(input.amount, money("0", input.amount.currency)) <= 0) throw new Error("Refund amount must be greater than zero.");
  const now = input.now ?? new Date().toISOString();
  const intent = saveIntent(repository, current, "PAYMENT", "REFUND", { orderId: current.orderId, buyerRef: current.buyerRef, amount: input.amount }, now);
  return { request: current, intent };
}

export function requestCreditNoteResolution(repository: ReturnRepository, returnId: string, input: ActorInput & { amount: { amount: string; currency: string }; invoiceIds: string[] }): { request: ReturnRequest; intent: ReturnResolutionIntent } {
  const current = repository.findById(returnId); if (!current) throw new Error(`Return ${returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_RESOLVE, "returns", current); assertResolutionReady(current);
  if (compareMoney(input.amount, money("0", input.amount.currency)) <= 0) throw new Error("Credit Note amount must be greater than zero.");
  if (!input.invoiceIds.length) throw new Error("Credit Note resolution requires at least one Invoice.");
  const now = input.now ?? new Date().toISOString();
  const intent = saveIntent(repository, current, "INVOICE", "CREDIT_NOTE", { orderId: current.orderId, buyerRef: current.buyerRef, amount: input.amount, invoiceIds: [...new Set(input.invoiceIds)] }, now);
  return { request: current, intent };
}

export function requestReplacementResolution(repository: ReturnRepository, returnId: string, input: ActorInput & { type: "REPLACEMENT" | "EXCHANGE"; lines: Array<{ productId: string; productNameSnapshot: string; quantity: number }>; commercialAdjustmentNote?: string; commercialDelta?: number; currency?: string }): { request: ReturnRequest; intent: ReturnResolutionIntent; paymentIntent?: ReturnResolutionIntent } {
  const current = repository.findById(returnId); if (!current) throw new Error(`Return ${returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_RESOLVE, "returns", current); assertResolutionReady(current);
  if (!input.lines.length || input.lines.some((line) => line.quantity <= 0)) throw new Error("Replacement/Exchange requires positive outbound lines.");
  const commercialDelta = input.type === "EXCHANGE" ? input.commercialDelta ?? 0 : 0;
  if (commercialDelta !== 0 && !input.currency) throw new Error("Exchange commercial delta requires currency.");
  const now = input.now ?? new Date().toISOString();
  const paymentIntent = commercialDelta > 0
    ? saveIntent(repository, current, "PAYMENT", "COLLECT_EXCHANGE_DELTA", { orderId: current.orderId, buyerRef: current.buyerRef, amount: commercialDelta, currency: input.currency }, now)
    : undefined;
  const intent = saveIntent(repository, current, "SHIPPING", "REPLACEMENT_OUTBOUND", { type: input.type, lines: input.lines, commercialAdjustmentNote: input.commercialAdjustmentNote, commercialDelta, currency: input.currency, paymentIntentId: paymentIntent?.id }, now);
  return { request: current, intent, paymentIntent };
}

export function requestRepairResolution(repository: ReturnRepository, returnId: string, input: ActorInput & { reference: string; provider?: string; expectedCompletionAt?: string }): { request: ReturnRequest; intent: ReturnResolutionIntent } {
  const current = repository.findById(returnId); if (!current) throw new Error(`Return ${returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_RESOLVE, "returns", current); assertResolutionReady(current);
  if (!input.reference.trim()) throw new Error("Repair resolution requires a repair job reference.");
  const now = input.now ?? new Date().toISOString();
  const repairJob = { reference: input.reference.trim(), provider: input.provider?.trim() || undefined, expectedCompletionAt: input.expectedCompletionAt, status: "CREATED" as const };
  const intent = saveIntent(repository, current, "REPAIR", "REPAIR", { repairJob }, now);
  return { request: current, intent };
}

export function completeRepairIntentFromEvidence(repository: ReturnRepository, intentId: string, input: ActorInput & { reference: string; result: string; provider?: string }): ReturnResolutionIntent {
  const intent = repository.listIntents().find((item) => item.id === intentId); if (!intent) throw new Error("Return intent not found.");
  if (intent.target !== "REPAIR" || intent.action !== "REPAIR") throw new Error("Repair evidence can only complete a REPAIR intent.");
  if (!input.reference.trim() || !input.result.trim()) throw new Error("Repair completion requires reference and result evidence.");
  const current = repository.findById(intent.returnId); if (!current) throw new Error(`Return ${intent.returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_RESOLVE, "returns", current);
  const now = input.now ?? new Date().toISOString();
  repository.saveIntent({ ...intent, payload: { ...intent.payload, repairJob: { reference: input.reference.trim(), provider: input.provider?.trim() || undefined, status: "COMPLETED", result: input.result.trim(), completedAt: now } } });
  return succeedReturnIntent(repository, intentId, { ...input, now, externalReference: input.reference.trim(), evidenceType: "REPAIR_COMPLETED" });
}

export function linkReturnIntentExternalReferences(repository: ReturnRepository, intentId: string, input: ActorInput & { externalReferences: string[] }): ReturnResolutionIntent {
  const intent = repository.listIntents().find((item) => item.id === intentId); if (!intent) throw new Error("Return intent not found.");
  const current = repository.findById(intent.returnId); if (!current) throw new Error(`Return ${intent.returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_RESOLVE, "returns", current);
  if (intent.status !== "PENDING") throw new Error("Only pending resolution intents can be linked to downstream work.");
  const refs = [...new Set(input.externalReferences.map((value) => value.trim()).filter(Boolean))];
  if (!refs.length) throw new Error("At least one external reference is required.");
  const saved = repository.saveIntent({ ...intent, externalReference: refs[0], externalReferences: refs });
  recordOperationalAudit({ moduleKey: "returns", recordId: intent.returnId, action: "ReturnResolutionIntentLinked", actorId: input.actorId, actorName: input.actorName, correlationId: intent.correlationId, before: intent, after: saved });
  return saved;
}

export function linkReturnIntentExternalReference(repository: ReturnRepository, intentId: string, input: ActorInput & { externalReference: string }): ReturnResolutionIntent {
  return linkReturnIntentExternalReferences(repository, intentId, { ...input, externalReferences: [input.externalReference] });
}

export function succeedReturnIntent(repository: ReturnRepository, intentId: string, input: ActorInput & { externalReference: string; evidenceType: "CREDIT_NOTE_ISSUED" | "REFUND_SUCCEEDED" | "PAYMENT_SUCCEEDED" | "SHIPPING_DELIVERED" | "REPAIR_COMPLETED" }): ReturnResolutionIntent {
  const intent = repository.listIntents().find((item) => item.id === intentId); if (!intent) throw new Error("Return intent not found.");
  const current = repository.findById(intent.returnId); if (!current) throw new Error(`Return ${intent.returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_RESOLVE, "returns", current);
  if (intent.status !== "PENDING") throw new Error("Only pending resolution intents can be completed.");
  const expected = intent.action === "CREDIT_NOTE" ? "CREDIT_NOTE_ISSUED" : intent.action === "REFUND" ? "REFUND_SUCCEEDED" : intent.action === "COLLECT_EXCHANGE_DELTA" ? "PAYMENT_SUCCEEDED" : intent.target === "SHIPPING" ? "SHIPPING_DELIVERED" : "REPAIR_COMPLETED";
  if (input.evidenceType !== expected) {
    if (intent.action === "REFUND") throw new Error("Payment resolution requires Refund Succeeded evidence.");
    throw new Error(`${intent.action} resolution requires ${expected} evidence.`);
  }
  if (!input.externalReference.trim()) throw new Error("Downstream success reference is required.");
  const now = input.now ?? new Date().toISOString();
  const saved = repository.saveIntent({ ...intent, status: "SUCCEEDED", completedAt: now, externalReference: input.externalReference.trim(), externalReferences: intent.externalReferences?.length ? intent.externalReferences : [input.externalReference.trim()], failureReason: undefined });
  recordOperationalAudit({ moduleKey: "returns", recordId: intent.returnId, action: "ReturnResolutionIntentSucceeded", actorId: input.actorId, actorName: input.actorName, correlationId: intent.correlationId, before: intent, after: saved });
  return saved;
}

function requiredIntentsForResolution(resolution: ReturnResolution): Array<{ target: ReturnResolutionIntent["target"]; action: ReturnResolutionIntent["action"] }> {
  if (resolution.type === "REFUND") {
    const required: Array<{ target: ReturnResolutionIntent["target"]; action: ReturnResolutionIntent["action"] }> = [{ target: "INVOICE", action: "CREDIT_NOTE" }];
    if (compareMoney(resolution.refundedAmount, money("0", resolution.refundedAmount.currency)) > 0) required.push({ target: "PAYMENT", action: "REFUND" });
    return required;
  }
  if (resolution.type === "REPLACEMENT") return [{ target: "SHIPPING", action: "REPLACEMENT_OUTBOUND" }];
  if (resolution.type === "EXCHANGE") {
    const required: Array<{ target: ReturnResolutionIntent["target"]; action: ReturnResolutionIntent["action"] }> = [{ target: "SHIPPING", action: "REPLACEMENT_OUTBOUND" }];
    if ((resolution.commercialDelta ?? 0) > 0) required.push({ target: "PAYMENT", action: "COLLECT_EXCHANGE_DELTA" });
    if ((resolution.commercialDelta ?? 0) < 0) {
      required.push({ target: "INVOICE", action: "CREDIT_NOTE" });
      if (resolution.refundedAmount && compareMoney(resolution.refundedAmount, money("0", resolution.refundedAmount.currency)) > 0) required.push({ target: "PAYMENT", action: "REFUND" });
    }
    return required;
  }
  if (resolution.type === "REPAIR") return [{ target: "REPAIR", action: "REPAIR" }];
  return [];
}

export function completeReturnResolution(repository: ReturnRepository, returnId: string, input: ActorInput & { resolution: ReturnResolution; intentId?: string; intentIds?: string[] }): ReturnRequest {
  const current = repository.findById(returnId); if (!current) throw new Error(`Return ${returnId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.RETURNS_RESOLVE, "returns", current); assertResolutionReady(current);
  if (input.resolution.type === "REFUND") {
    if (!input.resolution.creditNoteIds.length) throw new Error("Refund resolution requires issued Credit Note references.");
    if (input.resolution.creditedAmount.currency !== input.resolution.refundedAmount.currency) throw new Error("Refund resolution currencies must match.");
    if (compareMoney(input.resolution.refundedAmount, input.resolution.creditedAmount) > 0) throw new Error("Refunded amount cannot exceed credited amount.");
  }
  if (input.resolution.type === "EXCHANGE" && (input.resolution.commercialDelta ?? 0) < 0) {
    if (!input.resolution.creditNoteIds?.length || !input.resolution.creditedAmount || !input.resolution.refundedAmount) throw new Error("Negative Exchange requires Credit Note and refund evidence amounts.");
    if (input.resolution.creditedAmount.currency !== input.resolution.refundedAmount.currency) throw new Error("Exchange credit/refund currencies must match.");
    if (compareMoney(input.resolution.refundedAmount, input.resolution.creditedAmount) > 0) throw new Error("Exchange refunded amount cannot exceed credited amount.");
  }
  const required = requiredIntentsForResolution(input.resolution);
  const suppliedIds = [...new Set([...(input.intentIds ?? []), ...(input.intentId ? [input.intentId] : [])])];
  for (const requirement of required) {
    const intent = repository.listIntents().find((item) => suppliedIds.includes(item.id) && item.returnId === returnId && item.target === requirement.target && item.action === requirement.action);
    if (!intent) throw new Error(`${input.resolution.type} resolution requires canonical ${requirement.target}/${requirement.action} downstream evidence.`);
    if (intent.status !== "SUCCEEDED") throw new Error("Return cannot resolve until every matching downstream intent has succeeded.");
  }
  return transition(repository, returnId, "RESOLVED", input, CAPABILITIES.RETURNS_RESOLVE, { resolution: input.resolution, resolvedAt: input.now ?? new Date().toISOString() });
}

export function failReturnIntent(repository: ReturnRepository, intentId: string, input: ActorInput & { reason: string }): ReturnResolutionIntent {
  const intent = repository.listIntents().find((item) => item.id === intentId); if (!intent) throw new Error("Return intent not found.");
  if (!input.reason.trim()) throw new Error("Failure reason is required.");
  const saved = repository.saveIntent({ ...intent, status: "FAILED", failureReason: input.reason.trim() });
  recordOperationalAudit({ moduleKey: "returns", recordId: intent.returnId, action: "ReturnResolutionIntentFailed", actorId: input.actorId, actorName: input.actorName, reason: input.reason, before: intent, after: saved });
  return saved;
}

export function closeReturn(repository: ReturnRepository, returnId: string, input: ActorInput): ReturnRequest { return transition(repository, returnId, "CLOSED", input); }
