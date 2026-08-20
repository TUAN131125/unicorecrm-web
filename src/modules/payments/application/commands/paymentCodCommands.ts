import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control";
import type { PaymentRepository } from "../ports/PaymentRepository";
import type { CodCustomerCollectionState, CodMerchantRemittanceState, PaymentRecord } from "../../domain/model/paymentCollection.types";
import { getEffectivePaymentMethodCatalog } from "../queries/effectivePaymentMethodCatalog";
import type { PaymentConfiguration } from "../../domain/model/paymentConfiguration.types";

function requireCodPayment(repository: PaymentRepository, paymentRecordId: string, configuration?: PaymentConfiguration): PaymentRecord {
  const payment = repository.listPaymentRecords().find((item) => item.id === paymentRecordId);
  if (!payment) throw new Error(`Payment ${paymentRecordId} not found.`);
  const method = getEffectivePaymentMethodCatalog(repository.listPaymentMethods(), configuration).find((item) => item.code === payment.methodCode);
  if (method?.kind !== "COD") throw new Error("COD evidence requires a COD payment method.");
  return payment;
}

export function recordCodCustomerCollectionEvidence(
  repository: PaymentRepository,
  paymentRecordId: string,
  input: {
    expectedVersion: number;
    state: CodCustomerCollectionState;
    evidenceMetadata?: Record<string, string>;
    now: string;
  },
  configuration?: PaymentConfiguration,
): PaymentRecord {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_RECORD_MANUAL);
  const payment = requireCodPayment(repository, paymentRecordId, configuration);
  if (payment.version !== input.expectedVersion) throw new Error("PAYMENT_RECORD_VERSION_CONFLICT");
  return repository.savePaymentRecord({
    ...payment,
    codCustomerCollectionState: input.state,
    effectiveForReceivables: false,
    evidenceMetadata: { ...(payment.evidenceMetadata ?? {}), ...(input.evidenceMetadata ?? {}) },
    version: payment.version + 1,
    updatedAt: input.now,
  });
}

export function recordCodMerchantRemittanceEvidence(
  repository: PaymentRepository,
  paymentRecordId: string,
  input: {
    expectedVersion: number;
    state: CodMerchantRemittanceState;
    evidenceMetadata?: Record<string, string>;
    now: string;
  },
  configuration?: PaymentConfiguration,
): PaymentRecord {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_RECONCILE);
  const payment = requireCodPayment(repository, paymentRecordId, configuration);
  if (payment.version !== input.expectedVersion) throw new Error("PAYMENT_RECORD_VERSION_CONFLICT");
  if (input.state === "REMITTED" && payment.codCustomerCollectionState !== "COLLECTED") {
    throw new Error("COD_COLLECTION_REQUIRED_BEFORE_REMITTANCE");
  }
  return repository.savePaymentRecord({
    ...payment,
    codMerchantRemittanceState: input.state,
    effectiveForReceivables: input.state === "REMITTED",
    evidenceMetadata: { ...(payment.evidenceMetadata ?? {}), ...(input.evidenceMetadata ?? {}) },
    version: payment.version + 1,
    updatedAt: input.now,
  });
}
