import type { PaymentMigrationReview, PaymentObligation, PaymentTransaction } from "../../domain/model/payment.types";
import type { CustomerCredit, InvoicePaymentAllocation, PaymentIntent, PaymentMethodCatalogItem, PaymentProviderCatalogItem, PaymentRecord, RefundIntent } from "../../domain/model/paymentCollection.types";
import type { PaymentPlan, PaymentScheduleLine } from "../../domain/model/paymentPlan.types";

export interface PaymentRepositorySnapshot {
  /** Canonical payment obligations owned by the Payments module. */
  obligations: PaymentObligation[];
  /** Payment and refund transactions owned by the Payments module. */
  transactions: PaymentTransaction[];
  migrationReviews: PaymentMigrationReview[];
  plans: PaymentPlan[];
  scheduleLines: PaymentScheduleLine[];
  intents: PaymentIntent[];
  refundIntents: RefundIntent[];
  paymentRecords: PaymentRecord[];
  allocations: InvoicePaymentAllocation[];
  customerCredits: CustomerCredit[];
  methodCatalog: PaymentMethodCatalogItem[];
  providerCatalog: PaymentProviderCatalogItem[];
}

export interface PaymentRepository {
  snapshot(): PaymentRepositorySnapshot;
  listObligations(): PaymentObligation[];
  listTransactions(): PaymentTransaction[];
  listMigrationReviews(): PaymentMigrationReview[];
  saveObligation(obligation: PaymentObligation): PaymentObligation;
  saveTransaction(transaction: PaymentTransaction): PaymentTransaction;
  listPlans(): PaymentPlan[];
  listScheduleLines(): PaymentScheduleLine[];
  listIntents(): PaymentIntent[];
  listRefundIntents(): RefundIntent[];
  listPaymentRecords(): PaymentRecord[];
  listAllocations(): InvoicePaymentAllocation[];
  listCustomerCredits(): CustomerCredit[];
  listPaymentMethods(): PaymentMethodCatalogItem[];
  listPaymentProviders(): PaymentProviderCatalogItem[];
  savePlan(plan: PaymentPlan): PaymentPlan;
  saveScheduleLine(line: PaymentScheduleLine): PaymentScheduleLine;
  saveIntent(intent: PaymentIntent): PaymentIntent;
  saveRefundIntent(intent: RefundIntent): RefundIntent;
  savePaymentRecord(record: PaymentRecord): PaymentRecord;
  saveAllocation(allocation: InvoicePaymentAllocation): InvoicePaymentAllocation;
  saveCustomerCredit(credit: CustomerCredit): CustomerCredit;
  replace(snapshot: PaymentRepositorySnapshot): void;
  subscribe(listener: (snapshot: PaymentRepositorySnapshot) => void): () => void;
}
