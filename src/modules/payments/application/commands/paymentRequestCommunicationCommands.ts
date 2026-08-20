import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control";
import { recordOperationalAudit } from "@/platform/operational-audit";
import { recordCustomerCommunication } from "@/platform/notifications";
import type { PaymentRepository } from "../ports/PaymentRepository";
import type { PaymentIntent, PaymentRequestDelivery } from "../../domain/model/paymentCollection.types";

export interface RecordPaymentRequestDeliveryCommand {
  expectedVersion: number;
  delivery: PaymentRequestDelivery;
  actorId: string;
  actorName?: string;
  correlationId: string;
}

export function recordPaymentRequestDelivery(repository: PaymentRepository, intentId: string, command: RecordPaymentRequestDeliveryCommand): PaymentIntent {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_INTENT_CREATE);
  const current = repository.listIntents().find((item) => item.id === intentId);
  if (!current) throw new Error(`Payment Request ${intentId} not found.`);
  if (current.version !== command.expectedVersion) throw new Error("PAYMENT_INTENT_VERSION_CONFLICT");
  if (["CANCELLED", "EXPIRED"].includes(current.state)) throw new Error("PAYMENT_REQUEST_DELIVERY_BLOCKED");
  const replay = current.communicationHistory?.find((item) => item.id === command.delivery.id);
  if (replay) return current;
  const saved = repository.saveIntent({
    ...current,
    communicationHistory: [command.delivery, ...(current.communicationHistory ?? [])],
    version: current.version + 1,
    updatedAt: command.delivery.sentAt ?? command.delivery.createdAt,
  });
  recordOperationalAudit({ moduleKey: "payments", recordId: current.id, action: "PaymentRequestDeliveryRecorded", actorId: command.actorId, actorName: command.actorName, correlationId: command.correlationId, after: command.delivery });
  recordCustomerCommunication({
    id: command.delivery.id,
    event: "PaymentRequestSent",
    entityRef: { moduleKey: "payments", recordId: current.id, label: current.orderId },
    recipient: current.buyerRef.id,
    channel: command.delivery.channel === "EMAIL" ? "EMAIL" : command.delivery.channel === "QR" || command.delivery.channel === "LINK" ? "CUSTOMER_PORTAL" : "IN_APP",
    templateKey: command.delivery.templateKey,
    locale: "vi",
    subject: `Payment Request ${current.id}`,
    body: command.delivery.renderedContent,
    state: command.delivery.state === "SENT" ? "SENT" : command.delivery.state === "FAILED" ? "FAILED" : "SENDING",
    retryable: command.delivery.state === "FAILED",
    failureCode: command.delivery.failureCode,
    correlationId: command.correlationId,
    dedupeKey: `payment-request-delivery:${command.delivery.id}`,
    sentAt: command.delivery.sentAt,
  });
  return saved;
}
