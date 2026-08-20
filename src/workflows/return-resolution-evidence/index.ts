import { getPaymentTransactionSnapshot, getPaymentsSnapshot } from "@/modules/payments";
import { getInvoicesSnapshot } from "@/modules/invoices";
import {
  getReturnsSnapshot,
  succeedReturnIntentSnapshot,
  type ReturnResolutionIntent,
} from "@/modules/returns";
import {
  getShippingBookingSnapshot,
  isDeliveredShippingEvidence,
} from "@/modules/shipping";
import { compareMoney, money, sumMoney, type MoneyDto } from "@/shared/money";

function expectedIntentAmount(intent: ReturnResolutionIntent): MoneyDto {
  const value = intent.payload.amount;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.amount === "string" && typeof record.currency === "string") return money(record.amount, record.currency);
  }
  if ((typeof value === "number" || typeof value === "string") && typeof intent.payload.currency === "string") {
    return money(String(value), intent.payload.currency);
  }
  throw new Error("Payment resolution intent has an invalid expected amount.");
}

export function syncReturnResolutionIntentFromEvidence(
  intentId: string,
  input: { actorId: string; actorName?: string; now?: string },
): ReturnResolutionIntent {
  const intent = getReturnsSnapshot().intents.find((item) => item.id === intentId);
  if (!intent) throw new Error("Return resolution intent not found.");
  if (intent.status === "SUCCEEDED") return intent;
  const references = intent.externalReferences?.length ? intent.externalReferences : intent.externalReference ? [intent.externalReference] : [];
  if (!references.length) throw new Error("Return resolution intent has no downstream reference.");

  if (intent.target === "INVOICE") {
    if (intent.action !== "CREDIT_NOTE") throw new Error(`Unsupported Invoice intent action ${intent.action}.`);
    const creditNotes = getInvoicesSnapshot().creditNotes.filter((note) => references.includes(note.id));
    if (creditNotes.length !== references.length || creditNotes.some((note) => note.state !== "ISSUED" || note.sourceReturnId !== intent.returnId)) {
      throw new Error("Credit Note resolution requires canonical ISSUED Credit Note evidence owned by the same Return.");
    }
    return succeedReturnIntentSnapshot(intent.id, { externalReference: references[0], evidenceType: "CREDIT_NOTE_ISSUED", ...input });
  }

  if (intent.target === "PAYMENT") {
    const paymentSnapshot = getPaymentsSnapshot();
    const records = references.map((reference) => paymentSnapshot.paymentRecords.find((item) => item.id === reference));
    const transactions = references.map((reference) => getPaymentTransactionSnapshot(reference));
    const expectedAmount = expectedIntentAmount(intent);

    if (intent.action === "REFUND") {
      const request = getReturnsSnapshot().requests.find((item) => item.id === intent.returnId);
      if (!request || request.workspaceId !== intent.workspaceId) throw new Error("Refund resolution requires a Return in the same workspace.");
      if (records.some((record) => !record || record.kind !== "REFUND" || record.state !== "SUCCEEDED")) {
        throw new Error("Refund resolution requires canonical Payment REFUND SUCCEEDED evidence.");
      }
      const canonicalRecords = records.filter((record): record is NonNullable<typeof record> => Boolean(record));
      for (const record of canonicalRecords) {
        const refundIntent = paymentSnapshot.refundIntents.find((candidate) => candidate.id === record.refundIntentId);
        const sameBuyer = record.buyerRef.type === request.buyerRef.type && record.buyerRef.id === request.buyerRef.id;
        const sameIntentBuyer = refundIntent?.buyerRef.type === request.buyerRef.type && refundIntent.buyerRef.id === request.buyerRef.id;
        if (
          (record.workspaceId && record.workspaceId !== intent.workspaceId)
          || !sameBuyer
          || record.orderId !== request.orderId
          || record.amount.currency !== expectedAmount.currency
          || !refundIntent
          || refundIntent.sourceReturnId !== request.id
          || refundIntent.state !== "SUCCEEDED"
          || refundIntent.refundPaymentRecordId !== record.id
          || !sameIntentBuyer
          || refundIntent.orderId !== request.orderId
          || refundIntent.amount.currency !== expectedAmount.currency
          || compareMoney(refundIntent.amount, record.amount) !== 0
        ) {
          throw new Error("Refund evidence does not belong to this Return, buyer, Order, currency, and Refund Intent.");
        }
      }
      const refundedAmount = sumMoney(canonicalRecords.map((record) => record.amount), expectedAmount.currency);
      if (compareMoney(refundedAmount, expectedAmount) < 0) throw new Error("Refund resolution evidence does not cover the requested refund amount.");
      return succeedReturnIntentSnapshot(intent.id, { externalReference: references[0], evidenceType: "REFUND_SUCCEEDED", ...input });
    }

    if (intent.action === "COLLECT_EXCHANGE_DELTA") {
      const paymentIntents = references.map((reference) => paymentSnapshot.intents.find((item) => item.id === reference));
      const authoritativeIntentsValid = paymentIntents.every((paymentIntent) => paymentIntent?.state === "SUCCEEDED");
      const canonicalRecordsValid = records.every((record) => record?.kind === "PAYMENT" && record.state === "SUCCEEDED");
      const legacyTransactionsValid = transactions.every((transaction) => transaction?.kind === "PAYMENT" && transaction.status === "SUCCEEDED");
      if (!authoritativeIntentsValid && !canonicalRecordsValid && !legacyTransactionsValid) {
        throw new Error("Exchange delta collection requires provider-authoritative Payment Intent or Payment SUCCEEDED evidence.");
      }
      const collectedAmount = authoritativeIntentsValid
        ? paymentIntents.reduce((sum, paymentIntent) => sum + Number(paymentIntent?.amount.amount ?? 0), 0)
        : canonicalRecordsValid
          ? records.reduce((sum, record) => sum + Number(record?.amount.amount ?? 0), 0)
          : transactions.reduce((sum, transaction) => sum + (transaction?.amount ?? 0), 0);
      if (collectedAmount + Number.EPSILON < Number(expectedAmount.amount)) throw new Error("Exchange delta payment evidence does not cover the required amount.");
      return succeedReturnIntentSnapshot(intent.id, { externalReference: references[0], evidenceType: "PAYMENT_SUCCEEDED", ...input });
    }

    throw new Error(`Unsupported Payment intent action ${intent.action}.`);
  }

  if (intent.target === "REPAIR") throw new Error("Repair completion requires canonical repair evidence integration.");

  const booking = getShippingBookingSnapshot(references[0]);
  if (!booking || booking.sourceType !== "RETURN" || booking.sourceId !== intent.returnId || booking.purpose !== "REPLACEMENT_OUTBOUND" || !isDeliveredShippingEvidence(booking)) {
    throw new Error("Replacement resolution requires canonical Shipping DELIVERED evidence.");
  }
  return succeedReturnIntentSnapshot(intent.id, { externalReference: booking.id, evidenceType: "SHIPPING_DELIVERED", ...input });
}
