import {
  applyPaymentIntentProviderSnapshot,
  createPaymentIntentAuthoritative,
  getPaymentIntentStatusAuthoritative,
  getPaymentsSnapshot,
  replacePaymentsSnapshot,
} from "@/modules/payments";
import {
  getInvoicesSnapshot,
  replaceInvoicesSnapshot,
} from "@/modules/invoices";
import {
  completeRepairIntentFromEvidenceSnapshot,
  completeReturnResolutionSnapshot,
  configureReturnMethodSnapshot,
  getReturnSnapshot,
  getReturnsSnapshot,
  linkReturnIntentExternalReferenceSnapshot,
  linkReturnIntentExternalReferencesSnapshot,
  replaceReturnsSnapshot,
  requestRepairResolutionSnapshot,
  requestReplacementResolutionSnapshot,
  type ReturnRequest,
  type ReturnResolution,
} from "@/modules/returns";
import {
  createShippingBookingCommandBoundary,
  getShippingSnapshot,
  replaceShippingSnapshot,
  type ShippingBooking,
} from "@/modules/shipping";
import {
  createMutationMetadata,
  executeMutationCommand,
  type MutationCommandMetadata,
  type MutationOutcome,
} from "@/shared/application";
import type { MoneyDto } from "@/shared/money";
import { prepareReturnCreditRefundEvidence } from "@/workflows/return-credit-refund";
import { syncReturnResolutionIntentFromEvidence } from "@/workflows/return-resolution-evidence";

export interface BeginReturnReplacementCommand {
  returnId: string;
  type: "REPLACEMENT" | "EXCHANGE";
  lines: Array<{ productId: string; productNameSnapshot: string; quantity: number }>;
  commercialAdjustmentNote?: string;
  commercialDelta?: number;
  currency: string;
  paymentCollection?: Parameters<typeof createPaymentIntentAuthoritative>[0];
  creditRefund?: { amount: MoneyDto; reasonCode: string; reason: string };
  shippingBooking: Parameters<typeof createShippingBookingCommandBoundary>[0];
  actorId: string;
  actorName?: string;
  now?: string;
}

export interface BeginReturnPickupCommand {
  returnId: string;
  shippingBooking: Parameters<typeof createShippingBookingCommandBoundary>[0];
  actorId: string;
  actorName?: string;
  now?: string;
}

export async function beginReturnPickup(command: BeginReturnPickupCommand): Promise<ShippingBooking> {
  const returnBefore = getReturnsSnapshot();
  const shippingBefore = getShippingSnapshot();
  try {
    const booking = (await createShippingBookingCommandBoundary(command.shippingBooking, {
      actor: { id: command.actorId, name: command.actorName },
      correlationId: command.shippingBooking.correlationId,
      idempotencyKey: command.shippingBooking.idempotencyKey,
    })).data;
    if (booking.bookingStatus !== "BOOKED") throw new Error(booking.lastErrorMessage || "RETURN_PICKUP_BOOKING_FAILED");
    configureReturnMethodSnapshot(command.returnId, {
      method: "CARRIER_PICKUP",
      shippingBookingId: booking.id,
      actorId: command.actorId,
      actorName: command.actorName,
      now: command.now,
    });
    return booking;
  } catch (error) {
    replaceReturnsSnapshot(returnBefore);
    replaceShippingSnapshot(shippingBefore);
    throw error;
  }
}

export function beginReturnPickupCommand(
  command: BeginReturnPickupCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<ShippingBooking>> {
  const current = getReturnSnapshot(command.returnId);
  return executeMutationCommand(
    {
      commandType: "return.begin-carrier-pickup",
      aggregateType: "return",
      aggregateId: command.returnId,
      payload: command,
    },
    createMutationMetadata(`return.pickup:${command.returnId}`, {
      ...metadata,
      expectedVersion: metadata.expectedVersion ?? current?.version,
      actor: metadata.actor ?? { id: command.actorId, name: command.actorName },
    }),
    () => beginReturnPickup(command),
  );
}

export interface BeginReturnReplacementResult {
  status: "PAYMENT_PENDING" | "SHIPPING_BOOKED";
  shippingIntentId: string;
  paymentIntentId?: string;
  booking?: ShippingBooking;
}

export async function beginReturnReplacement(command: BeginReturnReplacementCommand): Promise<BeginReturnReplacementResult> {
  const returnBefore = getReturnsSnapshot();
  const paymentBefore = getPaymentsSnapshot();
  const invoiceBefore = getInvoicesSnapshot();
  const shippingBefore = getShippingSnapshot();
  const now = command.now ?? new Date().toISOString();
  try {
    const result = requestReplacementResolutionSnapshot(command.returnId, {
      type: command.type,
      lines: command.lines,
      commercialAdjustmentNote: command.commercialAdjustmentNote,
      commercialDelta: command.commercialDelta,
      currency: command.currency,
      actorId: command.actorId,
      actorName: command.actorName,
      now,
    });

    let paymentIntentId: string | undefined;
    if (command.type === "EXCHANGE" && (command.commercialDelta ?? 0) > 0) {
      if (!result.paymentIntent || !command.paymentCollection) {
        throw new Error("EXCHANGE_COLLECTION_INTENT_REQUIRED");
      }
      const paymentIntent = await createPaymentIntentAuthoritative({
        ...command.paymentCollection,
        clientPayload: {
          ...(command.paymentCollection.clientPayload ?? {}),
          returnId: command.returnId,
          returnIntentId: result.paymentIntent.id,
        },
      });
      paymentIntentId = paymentIntent.id;
      linkReturnIntentExternalReferencesSnapshot(result.paymentIntent.id, {
        externalReferences: [paymentIntent.id],
        actorId: command.actorId,
        actorName: command.actorName,
        now,
      });
      const authoritative = await getPaymentIntentStatusAuthoritative(paymentIntent.id);
      applyPaymentIntentProviderSnapshot(authoritative);
      if (authoritative.state !== "SUCCEEDED") {
        return { status: "PAYMENT_PENDING", shippingIntentId: result.intent.id, paymentIntentId };
      }
      syncReturnResolutionIntentFromEvidence(result.paymentIntent.id, {
        actorId: command.actorId,
        actorName: command.actorName,
        now,
      });
    }

    if (command.type === "EXCHANGE" && (command.commercialDelta ?? 0) < 0) {
      if (!command.creditRefund) throw new Error("EXCHANGE_CREDIT_REFUND_EVIDENCE_REQUIRED");
      await prepareReturnCreditRefundEvidence({
        returnId: command.returnId,
        amount: command.creditRefund.amount,
        reasonCode: command.creditRefund.reasonCode,
        reason: command.creditRefund.reason,
        actorId: command.actorId,
        actorName: command.actorName,
        now,
      });
    }

    const booking = (await createShippingBookingCommandBoundary(command.shippingBooking, {
      actor: { id: command.actorId, name: command.actorName },
      correlationId: command.shippingBooking.correlationId,
      idempotencyKey: command.shippingBooking.idempotencyKey,
    })).data;
    if (booking.bookingStatus !== "BOOKED") throw new Error(booking.lastErrorMessage || "SHIPPING_BOOKING_FAILED");
    linkReturnIntentExternalReferenceSnapshot(result.intent.id, {
      externalReference: booking.id,
      actorId: command.actorId,
      actorName: command.actorName,
      now,
    });
    return { status: "SHIPPING_BOOKED", shippingIntentId: result.intent.id, paymentIntentId, booking };
  } catch (error) {
    replaceReturnsSnapshot(returnBefore);
    replacePaymentsSnapshot(paymentBefore);
    replaceInvoicesSnapshot(invoiceBefore);
    replaceShippingSnapshot(shippingBefore);
    throw error;
  }
}

export function beginReturnReplacementCommand(
  command: BeginReturnReplacementCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<BeginReturnReplacementResult>> {
  const current = getReturnSnapshot(command.returnId);
  return executeMutationCommand(
    {
      commandType: "return.begin-replacement-resolution",
      aggregateType: "return",
      aggregateId: command.returnId,
      payload: command,
    },
    createMutationMetadata(`return.replacement:${command.returnId}`, {
      ...metadata,
      expectedVersion: metadata.expectedVersion ?? current?.version,
      actor: metadata.actor ?? { id: command.actorId, name: command.actorName },
    }),
    () => beginReturnReplacement(command),
  );
}

export interface CompleteReturnReplacementCommand {
  returnId: string;
  shippingIntentId: string;
  resolution: ReturnResolution;
  intentIds: string[];
  actorId: string;
  actorName?: string;
  now?: string;
}

export function completeReturnReplacementFromDelivery(command: CompleteReturnReplacementCommand): ReturnRequest {
  const before = getReturnsSnapshot();
  const now = command.now ?? new Date().toISOString();
  try {
    syncReturnResolutionIntentFromEvidence(command.shippingIntentId, {
      actorId: command.actorId,
      actorName: command.actorName,
      now,
    });
    return completeReturnResolutionSnapshot(command.returnId, {
      resolution: command.resolution,
      intentIds: command.intentIds,
      actorId: command.actorId,
      actorName: command.actorName,
      now,
    });
  } catch (error) {
    replaceReturnsSnapshot(before);
    throw error;
  }
}

export function completeReturnReplacementFromDeliveryCommand(
  command: CompleteReturnReplacementCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<ReturnRequest>> {
  const current = getReturnSnapshot(command.returnId);
  return executeMutationCommand(
    {
      commandType: "return.complete-replacement-from-delivery",
      aggregateType: "return",
      aggregateId: command.returnId,
      payload: command,
    },
    createMutationMetadata(`return.complete-replacement:${command.returnId}`, {
      ...metadata,
      expectedVersion: metadata.expectedVersion ?? current?.version,
      actor: metadata.actor ?? { id: command.actorId, name: command.actorName },
    }),
    () => completeReturnReplacementFromDelivery(command),
  );
}

export interface CompleteReturnRepairCommand {
  returnId: string;
  reference: string;
  provider?: string;
  result: string;
  actorId: string;
  actorName?: string;
  now?: string;
}

export function completeReturnRepair(command: CompleteReturnRepairCommand): ReturnRequest {
  const before = getReturnsSnapshot();
  const now = command.now ?? new Date().toISOString();
  try {
    const requested = requestRepairResolutionSnapshot(command.returnId, {
      reference: command.reference,
      provider: command.provider,
      actorId: command.actorId,
      actorName: command.actorName,
      now,
    });
    const evidence = completeRepairIntentFromEvidenceSnapshot(requested.intent.id, {
      reference: command.reference,
      provider: command.provider,
      result: command.result,
      actorId: command.actorId,
      actorName: command.actorName,
      now,
    });
    return completeReturnResolutionSnapshot(command.returnId, {
      resolution: {
        type: "REPAIR",
        repairJob: {
          reference: command.reference,
          provider: command.provider,
          status: "COMPLETED",
          result: command.result,
        },
      },
      intentId: evidence.id,
      actorId: command.actorId,
      actorName: command.actorName,
      now,
    });
  } catch (error) {
    replaceReturnsSnapshot(before);
    throw error;
  }
}

export function completeReturnRepairCommand(
  command: CompleteReturnRepairCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<ReturnRequest>> {
  const current = getReturnSnapshot(command.returnId);
  return executeMutationCommand(
    {
      commandType: "return.complete-repair-resolution",
      aggregateType: "return",
      aggregateId: command.returnId,
      payload: command,
    },
    createMutationMetadata(`return.repair:${command.returnId}`, {
      ...metadata,
      expectedVersion: metadata.expectedVersion ?? current?.version,
      actor: metadata.actor ?? { id: command.actorId, name: command.actorName },
    }),
    () => completeReturnRepair(command),
  );
}
