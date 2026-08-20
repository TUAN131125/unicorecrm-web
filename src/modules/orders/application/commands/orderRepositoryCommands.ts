import { relationshipRefKey } from "@/platform/identity";
import type { CustomerOrder } from "../../domain/model/order.types";
import { withCanonicalOrderPricing } from "../../domain/rules/orderCalculations";
import { assertOrderCommercialMutationAllowed } from "../../domain/rules/orderCommercialIntegrity";
import { assertCanonicalOrderInvariant } from "../../domain/rules/orderLifecycle";
import type { OrderCollection, OrderRepository } from "../ports/OrderRepository";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability } from "@/platform/access-control";
import { assertDestructiveActionAllowed } from "@/shared/application";

export type OrderCollectionUpdater = OrderCollection | ((current: OrderCollection) => OrderCollection);

function canonicalize(order: CustomerOrder): CustomerOrder {
  const canonical = withCanonicalOrderPricing(structuredClone(order));
  assertCanonicalOrderInvariant(canonical);
  return canonical;
}

function flatten(collection: OrderCollection): CustomerOrder[] {
  return Object.values(collection).flat();
}

function validateCollection(collection: OrderCollection): void {
  const ids = new Set<string>();
  const numbers = new Set<string>();
  const sourceQuotes = new Set<string>();
  flatten(collection).forEach((order) => {
    assertCanonicalOrderInvariant(order);
    if (ids.has(order.id)) throw new Error(`Duplicate Order id: ${order.id}`);
    if (numbers.has(order.orderNumber)) throw new Error(`Duplicate Order number: ${order.orderNumber}`);
    if (order.sourceQuoteId && sourceQuotes.has(order.sourceQuoteId)) {
      throw new Error(`Quote ${order.sourceQuoteId} has already been converted to an Order.`);
    }
    ids.add(order.id);
    numbers.add(order.orderNumber);
    if (order.sourceQuoteId) sourceQuotes.add(order.sourceQuoteId);
  });
}

function canonicalCollection(collection: OrderCollection): OrderCollection {
  return Object.fromEntries(Object.entries(collection).map(([key, orders]) => [key, orders.map(canonicalize)]));
}

export function updateOrderCollection(repository: OrderRepository, updater: OrderCollectionUpdater): OrderCollection {
  assertRuntimeCapability(CAPABILITIES.ORDERS_UPDATE);
  const current = repository.snapshot();
  const currentById = new Map(flatten(current).map((order) => [order.id, order]));
  const proposed = typeof updater === "function" ? updater(current) : updater;
  const next = canonicalCollection(proposed);
  flatten(next).forEach((order) => {
    const previous = currentById.get(order.id);
    if (previous) assertOrderCommercialMutationAllowed(withCanonicalOrderPricing(previous), order);
  });
  validateCollection(next);
  repository.replace(next);
  return repository.snapshot();
}

export function saveOrder(repository: OrderRepository, order: CustomerOrder): CustomerOrder {
  const canonical = canonicalize(order);
  const previous = repository.getById(order.id);
  assertRuntimeCommandAccess(previous ? CAPABILITIES.ORDERS_UPDATE : CAPABILITIES.ORDERS_CREATE, "orders", previous);
  if (previous) assertOrderCommercialMutationAllowed(withCanonicalOrderPricing(previous), canonical);
  const next = repository.snapshot();
  for (const partitionKey of Object.keys(next)) {
    next[partitionKey] = (next[partitionKey] ?? []).filter((item) => item.id !== canonical.id);
  }
  const partitionKey = relationshipRefKey(canonical.buyerRef);
  next[partitionKey] = [structuredClone(canonical), ...(next[partitionKey] ?? [])];
  validateCollection(next);
  repository.replace(next);
  return structuredClone(canonical);
}

export function updateOrder(
  repository: OrderRepository,
  orderId: string,
  transform: (order: CustomerOrder) => CustomerOrder,
): CustomerOrder | undefined {
  let updated: CustomerOrder | undefined;
  const next = repository.snapshot();
  for (const partitionKey of Object.keys(next)) {
    next[partitionKey] = (next[partitionKey] ?? []).map((order) => {
      if (order.id !== orderId) return order;
      assertRuntimeCommandAccess(CAPABILITIES.ORDERS_UPDATE, "orders", order);
      const canonical = canonicalize(transform(structuredClone(order)));
      assertOrderCommercialMutationAllowed(withCanonicalOrderPricing(order), canonical);
      updated = canonical;
      return canonical;
    });
  }
  validateCollection(next);
  repository.replace(next);
  return updated ? structuredClone(updated) : undefined;
}

export function updateManyOrders(
  repository: OrderRepository,
  orderIds: readonly string[],
  transform: (order: CustomerOrder) => CustomerOrder,
): number {
  assertRuntimeCapability(CAPABILITIES.ORDERS_BULK);
  const ids = new Set(orderIds);
  let count = 0;
  const next = repository.snapshot();
  for (const partitionKey of Object.keys(next)) {
    next[partitionKey] = (next[partitionKey] ?? []).map((order) => {
      if (!ids.has(order.id)) return order;
      assertRuntimeCommandAccess(CAPABILITIES.ORDERS_BULK, "orders", order);
      const canonical = canonicalize(transform(structuredClone(order)));
      assertOrderCommercialMutationAllowed(withCanonicalOrderPricing(order), canonical);
      count += 1;
      return canonical;
    });
  }
  validateCollection(next);
  repository.replace(next);
  return count;
}

export interface OrderArchiveCommandInput {
  reason: string;
  actorId: string;
  actorName?: string;
  now?: string;
}

export function archiveOrder(repository: OrderRepository, orderId: string, input: OrderArchiveCommandInput): CustomerOrder {
  const target = repository.getById(orderId);
  if (!target) throw new Error(`Order ${orderId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.ORDERS_DELETE, "orders", target);
  assertDestructiveActionAllowed({ recordType: "Order", retentionClass: "DURABLE", action: "ARCHIVE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  let archived: CustomerOrder | undefined;
  const next: OrderCollection = Object.fromEntries(Object.entries(repository.snapshot()).map(([buyerKey, orders]) => [
    buyerKey,
    orders.map((order) => {
      if (order.id !== orderId) return order;
      archived = { ...order, archivedAt: now, archiveReason: input.reason.trim(), updatedAt: now };
      return archived;
    }),
  ]));
  repository.replace(next);
  return structuredClone(archived!);
}

export function archiveOrders(repository: OrderRepository, orderIds: readonly string[], input: OrderArchiveCommandInput): CustomerOrder[] {
  assertRuntimeCapability(CAPABILITIES.ORDERS_DELETE);
  const ids = new Set(orderIds);
  const archived: CustomerOrder[] = [];
  const now = input.now ?? new Date().toISOString();
  const next: OrderCollection = Object.fromEntries(Object.entries(repository.snapshot()).map(([buyerKey, orders]) => [
    buyerKey,
    orders.map((order) => {
      if (!ids.has(order.id)) return order;
      assertRuntimeCommandAccess(CAPABILITIES.ORDERS_DELETE, "orders", order);
      assertDestructiveActionAllowed({ recordType: "Order", retentionClass: "DURABLE", action: "ARCHIVE", reason: input.reason });
      const value = { ...order, archivedAt: now, archiveReason: input.reason.trim(), updatedAt: now };
      archived.push(value);
      return value;
    }),
  ]));
  repository.replace(next);
  return structuredClone(archived);
}
