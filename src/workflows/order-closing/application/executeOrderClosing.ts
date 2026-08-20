import type { PurchaseEvidence } from "@/modules/commercial-evidence";
import type { OrderClosingPorts } from "./ports/OrderClosingPorts";
import { evaluateOrderClosingPolicy, STANDARD_ORDER_CLOSING_POLICY, type OrderClosingPolicy } from "../domain/orderClosingPolicy";

export interface ExecuteOrderClosingCommand {
  orderIds: string[];
  workspaceId?: string;
  correlationId?: string;
  now?: Date;
  policy?: OrderClosingPolicy;
}

export interface OrderClosingBlockedItem {
  orderId: string;
  blockers: string[];
}

export interface OrderClosingResult {
  completedIds: string[];
  alreadyCompletedIds: string[];
  missingIds: string[];
  blocked: OrderClosingBlockedItem[];
  evidenceIds: string[];
}

export function executeOrderClosing(command: ExecuteOrderClosingCommand, ports: OrderClosingPorts): OrderClosingResult {
  const now = command.now ?? new Date();
  const nowIso = now.toISOString();
  const workspaceId = command.workspaceId ?? "workspace-default";
  const policy = command.policy ?? STANDARD_ORDER_CLOSING_POLICY;
  const byId = new Map(ports.orders.list().map((order) => [order.id, order]));
  const completedIds: string[] = [];
  const alreadyCompletedIds: string[] = [];
  const missingIds: string[] = [];
  const blocked: OrderClosingBlockedItem[] = [];
  const evidenceIds: string[] = [];

  for (const orderId of [...new Set(command.orderIds)]) {
    const order = byId.get(orderId);
    if (!order) { missingIds.push(orderId); continue; }
    const existingEvidence = ports.evidence.findOrderCompleted(orderId);
    if (order.state === "COMPLETED") {
      alreadyCompletedIds.push(orderId);
      if (existingEvidence) evidenceIds.push(existingEvidence.evidenceId);
      continue;
    }
    if (order.state !== "CONFIRMED") {
      blocked.push({ orderId, blockers: [`Order must be CONFIRMED before closing; received ${order.state}.`] });
      continue;
    }

    const evaluation = evaluateOrderClosingPolicy(
      order,
      ports.payments.evaluateCompletion(order),
      ports.shipping.listForOrder(order.id),
      policy,
    );
    if (!evaluation.ready) { blocked.push({ orderId, blockers: evaluation.blockers }); continue; }

    const correlationId = command.correlationId ? `${command.correlationId}:${orderId}` : `order-closing:${orderId}`;
    const evidenceId = existingEvidence?.evidenceId ?? `pe_order_${orderId}`;
    const orderSnapshot = ports.orders.snapshot();
    try {
      const evidence = ports.evidence.runAtomically<PurchaseEvidence>(() => {
        const completionResult = ports.orders.complete(orderId, {
          policyVersion: policy.policyVersion,
          correlationId,
          evidenceId,
          occurredAt: nowIso,
          shippingEvidenceIds: evaluation.shippingEvidenceIds,
        });
        if (!completionResult.success) throw new Error(completionResult.message ?? "Order completion failed.");
        return existingEvidence ?? ports.evidence.recordOrderCompleted({ evidenceId, workspaceId, order, occurredAt: nowIso, policyVersion: policy.policyVersion, correlationId });
      });
      completedIds.push(orderId);
      evidenceIds.push(evidence.evidenceId);
    } catch (error) {
      ports.orders.restore(orderSnapshot);
      blocked.push({ orderId, blockers: [error instanceof Error ? error.message : "Order completion failed."] });
    }
  }

  return { completedIds, alreadyCompletedIds, missingIds, blocked, evidenceIds };
}
