import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control";
import { recordOperationalAudit } from "@/platform/operational-audit";
import type { PaymentRepository } from "../ports/PaymentRepository";
import type { PaymentRecord } from "../../domain/model/paymentCollection.types";

export interface PaymentReconciliationInput {
  expectedVersion: number;
  state: "MATCHED" | "MISMATCH";
  note?: string;
}

/** Demo/local execution context. Connected mode receives actor, time and correlation from the backend. */
export interface ReconcilePaymentRecordCommand extends PaymentReconciliationInput {
  expectedVersion: number;
  state: "MATCHED" | "MISMATCH";
  note?: string;
  actorId: string;
  actorName?: string;
  correlationId: string;
  now: string;
}

export function reconcilePaymentRecord(repository: PaymentRepository, paymentRecordId: string, command: ReconcilePaymentRecordCommand): PaymentRecord {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_RECONCILE);
  const current = repository.listPaymentRecords().find((item) => item.id === paymentRecordId);
  if (!current) throw new Error(`Payment Record ${paymentRecordId} not found.`);
  if (current.version !== command.expectedVersion) throw new Error("PAYMENT_RECORD_VERSION_CONFLICT");
  if (current.state !== "SUCCEEDED") throw new Error("PAYMENT_RECORD_RECONCILIATION_BLOCKED");
  const saved = repository.savePaymentRecord({
    ...current,
    reconciliationState: command.state,
    evidenceMetadata: {
      ...(current.evidenceMetadata ?? {}),
      reconciliationNote: command.note?.trim() ?? "",
      reconciledBy: command.actorId,
      reconciledAt: command.now,
    },
    version: current.version + 1,
    updatedAt: command.now,
  });
  recordOperationalAudit({
    moduleKey: "payments",
    recordId: current.id,
    action: command.state === "MATCHED" ? "PaymentRecordReconciled" : "PaymentRecordMismatchMarked",
    actorId: command.actorId,
    actorName: command.actorName,
    correlationId: command.correlationId,
    before: current,
    after: saved,
  });
  return saved;
}
