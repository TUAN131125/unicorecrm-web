import type { AppEventBus } from "@/platform/events";
import type { StoragePort } from "@/platform/persistence";
import type { OrderCollection, OrderRepository } from "../application/ports/OrderRepository";
import type { CustomerOrder } from "../domain/model/order.types";
import { withCanonicalOrderPricing } from "../domain/rules/orderCalculations";
import { assertCanonicalOrderInvariant } from "../domain/rules/orderLifecycle";
import { money } from "@/shared/money";
import { canonicalPaymentMethodCodeForKind } from "@/shared/order-to-cash";

export const ORDERS_CHANGED_EVENT = "unicore.orders.changed";
const STORAGE_KEY = "snapshot";
const STORAGE_VERSION = 1;

interface PersistedOrderSnapshot {
  version: number;
  records: OrderCollection;
}

export class InMemoryOrderRepository implements OrderRepository {
  private orders: OrderCollection;

  constructor(seed: OrderCollection, private readonly events: AppEventBus, private readonly storage?: StoragePort) {
    this.orders = this.load(seed);
  }

  snapshot(): OrderCollection { return cloneCollection(this.orders); }
  list(): CustomerOrder[] { return flattenCollection(this.orders); }

  getById(orderId: string): CustomerOrder | undefined {
    const order = this.list().find((item) => item.id === orderId);
    return order ? structuredClone(order) : undefined;
  }

  replace(orders: OrderCollection): void {
    const canonical = canonicalizeCollection(orders);
    this.assertUnique(canonical);
    this.persist(canonical);
    this.orders = cloneCollection(canonical);
    this.events.publish<OrderCollection>(ORDERS_CHANGED_EVENT, this.snapshot());
  }

  subscribe(listener: (orders: OrderCollection) => void): () => void {
    return this.events.subscribe<OrderCollection>(ORDERS_CHANGED_EVENT, listener);
  }

  private load(seed: OrderCollection): OrderCollection {
    const stored = this.storage?.get<unknown>(STORAGE_KEY);
    const candidate = stored && typeof stored === "object" && !Array.isArray(stored) && "records" in stored
      ? (stored as PersistedOrderSnapshot).records
      : stored && typeof stored === "object" && !Array.isArray(stored)
        ? stored as OrderCollection
        : seed;
    try {
      const canonical = canonicalizeCollection(candidate);
      this.assertUnique(canonical);
      if (this.storage && candidate === seed) this.persist(canonical);
      return canonical;
    } catch {
      const canonicalSeed = canonicalizeCollection(seed);
      this.storage?.remove(STORAGE_KEY);
      if (this.storage) this.persist(canonicalSeed);
      return canonicalSeed;
    }
  }

  private persist(orders: OrderCollection): void {
    if (!this.storage) return;
    const snapshot: PersistedOrderSnapshot = { version: STORAGE_VERSION, records: cloneCollection(orders) };
    this.storage.set(STORAGE_KEY, snapshot);
    const verified = this.storage.get<PersistedOrderSnapshot>(STORAGE_KEY);
    if (!verified || verified.version !== STORAGE_VERSION || JSON.stringify(verified.records) !== JSON.stringify(snapshot.records)) {
      throw new Error("Order data could not be saved to browser storage. Your changes were not committed.");
    }
  }

  private assertUnique(orders: OrderCollection): void {
    const ids = new Set<string>();
    const numbers = new Set<string>();
    const sourceQuotes = new Set<string>();
    for (const order of flattenCollection(orders)) {
      if (ids.has(order.id)) throw new Error(`Duplicate Order id: ${order.id}`);
      if (numbers.has(order.orderNumber)) throw new Error(`Duplicate Order number: ${order.orderNumber}`);
      if (order.sourceQuoteId && sourceQuotes.has(order.sourceQuoteId)) throw new Error(`Quote ${order.sourceQuoteId} has already been converted to an Order.`);
      ids.add(order.id);
      numbers.add(order.orderNumber);
      if (order.sourceQuoteId) sourceQuotes.add(order.sourceQuoteId);
    }
  }
}


type StoredCustomerOrder = CustomerOrder & { paymentMethod?: string; codAmount?: number } & Record<string, unknown>;

function normalizePersistedOrderLifecycle(order: StoredCustomerOrder): CustomerOrder {
  const legacy = structuredClone(order) as StoredCustomerOrder;
  const legacyState = String(legacy.state);
  const migratedState = legacyState === "FAILED" ? "CONFIRMED" : legacy.state;
  const legacyPaymentMethod = legacy.paymentMethod;
  const {
    failure: _failure,
    failedAt: _failedAt,
    legacyNormalization: _legacyNormalization,
    paymentMethod: _legacyPaymentMethod,
    codAmount: _legacyCodAmount,
    ...withoutLegacy
  } = legacy;
  const normalized: CustomerOrder = {
    ...(withoutLegacy as CustomerOrder),
    state: migratedState as CustomerOrder["state"],
  };
  if ((normalized.state === "CONFIRMED" || normalized.state === "COMPLETED") && !normalized.confirmedAt) {
    normalized.confirmedAt = normalized.createdAt ?? `${normalized.orderDate}T00:00:00.000Z`;
  }
  if ((normalized.state === "CONFIRMED" || normalized.state === "COMPLETED") && !normalized.paymentAgreementSnapshot) {
    const currency = normalized.currency ?? "VND";
    const methodKind = legacyPaymentMethod === "COD" ? "COD" : "BANK_TRANSFER";
    const methodCode = canonicalPaymentMethodCodeForKind(methodKind);
    normalized.paymentAgreementSnapshot = {
      version: 1,
      kind: "FULL_PAYMENT",
      currency,
      policyVersion: "persisted-order-payment-agreement-backfill/v1",
      sourceQuoteId: normalized.sourceQuoteId,
      acceptedAt: normalized.confirmedAt,
      lines: [{
        id: `agreement:${normalized.id}:1`,
        sequence: 1,
        label: "Thanh toán toàn bộ",
        purpose: "FULL",
        amountRule: { type: "REMAINDER" },
        previewAmount: money(String(normalized.grandTotal ?? normalized.totalAmount), currency),
        dueRule: { type: "EVENT_RELATIVE", event: "ORDER_CONFIRMED", offsetDays: 0, dayBasis: "CALENDAR" },
        allowedMethodCodes: [methodCode],
        preferredMethodCode: methodCode,
        fulfillmentGate: methodKind === "COD" ? "NONE" : "BEFORE_COMPLETION",
        invoicePolicyCode: "STANDARD_ORDER_INVOICE",
      }],
    };
  }
  return normalized;
}

function canonicalizeCollection(orders: OrderCollection): OrderCollection {
  return Object.fromEntries(Object.entries(structuredClone(orders)).map(([partition, records]) => [
    partition,
    records.map((order) => {
      const canonical = withCanonicalOrderPricing(normalizePersistedOrderLifecycle(order as StoredCustomerOrder));
      assertCanonicalOrderInvariant(canonical);
      return canonical;
    }),
  ]));
}

function cloneCollection(orders: OrderCollection): OrderCollection { return structuredClone(orders); }

function flattenCollection(orders: OrderCollection): CustomerOrder[] {
  const seen = new Set<string>();
  return Object.values(orders)
    .flatMap((partitionOrders) => partitionOrders.map((order) => ({ ...order })))
    .filter((order) => !seen.has(order.id) && Boolean(seen.add(order.id)))
    .sort((left, right) => right.orderDate.localeCompare(left.orderDate));
}
