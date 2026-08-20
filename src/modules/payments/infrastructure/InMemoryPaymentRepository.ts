import type { PaymentRepository, PaymentRepositorySnapshot } from "../application/ports/PaymentRepository";
import type { PaymentObligation, PaymentTransaction } from "../domain/model/payment.types";
import type { CustomerCredit, InvoicePaymentAllocation, PaymentIntent, PaymentMethodCatalogItem, PaymentProviderCatalogItem, PaymentRecord, RefundIntent } from "../domain/model/paymentCollection.types";
import type { PaymentPlan, PaymentScheduleLine } from "../domain/model/paymentPlan.types";
import { normalizePaymentRepositorySnapshot } from "./normalizePaymentRepositorySnapshot";

export class InMemoryPaymentRepository implements PaymentRepository {
  private state: PaymentRepositorySnapshot;
  private readonly listeners = new Set<(snapshot: PaymentRepositorySnapshot) => void>();

  constructor(seed: Partial<PaymentRepositorySnapshot> = {}) {
    this.state = normalizePaymentRepositorySnapshot(seed);
  }

  snapshot(): PaymentRepositorySnapshot { return structuredClone(this.state); }
  listObligations(): PaymentObligation[] { return structuredClone(this.state.obligations); }
  listTransactions(): PaymentTransaction[] { return structuredClone(this.state.transactions); }
  listMigrationReviews() { return structuredClone(this.state.migrationReviews); }
  listPlans(): PaymentPlan[] { return structuredClone(this.state.plans); }
  listScheduleLines(): PaymentScheduleLine[] { return structuredClone(this.state.scheduleLines); }
  listIntents(): PaymentIntent[] { return structuredClone(this.state.intents); }
  listRefundIntents(): RefundIntent[] { return structuredClone(this.state.refundIntents); }
  listPaymentRecords(): PaymentRecord[] { return structuredClone(this.state.paymentRecords); }
  listAllocations(): InvoicePaymentAllocation[] { return structuredClone(this.state.allocations); }
  listCustomerCredits(): CustomerCredit[] { return structuredClone(this.state.customerCredits); }
  listPaymentMethods(): PaymentMethodCatalogItem[] { return structuredClone(this.state.methodCatalog); }
  listPaymentProviders(): PaymentProviderCatalogItem[] { return structuredClone(this.state.providerCatalog); }

  saveObligation(obligation: PaymentObligation): PaymentObligation { return this.save("obligations", obligation); }
  saveTransaction(transaction: PaymentTransaction): PaymentTransaction { return this.save("transactions", transaction); }
  savePlan(plan: PaymentPlan): PaymentPlan { return this.save("plans", plan); }
  saveScheduleLine(line: PaymentScheduleLine): PaymentScheduleLine { return this.save("scheduleLines", line); }
  saveIntent(intent: PaymentIntent): PaymentIntent { return this.save("intents", intent); }
  saveRefundIntent(intent: RefundIntent): RefundIntent { return this.save("refundIntents", intent); }
  savePaymentRecord(record: PaymentRecord): PaymentRecord { return this.save("paymentRecords", record); }
  saveAllocation(allocation: InvoicePaymentAllocation): InvoicePaymentAllocation { return this.save("allocations", allocation); }
  saveCustomerCredit(credit: CustomerCredit): CustomerCredit { return this.save("customerCredits", credit); }

  replace(snapshot: PaymentRepositorySnapshot): void {
    this.state = normalizePaymentRepositorySnapshot(snapshot);
    this.emit();
  }

  subscribe(listener: (snapshot: PaymentRepositorySnapshot) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private save<
    K extends Exclude<keyof PaymentRepositorySnapshot, "migrationReviews" | "methodCatalog" | "providerCatalog">,
    T extends PaymentRepositorySnapshot[K][number] & { id: string },
  >(key: K, value: T): T {
    const collection = this.state[key] as Array<{ id: string }>;
    const nextCollection = [structuredClone(value), ...collection.filter((item) => item.id !== value.id)];
    this.state = { ...this.state, [key]: nextCollection } as PaymentRepositorySnapshot;
    this.emit();
    return structuredClone(value);
  }

  private emit(): void { const snapshot = this.snapshot(); this.listeners.forEach((listener) => listener(snapshot)); }
}
