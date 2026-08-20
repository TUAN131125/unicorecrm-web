import type { CustomerOrder } from "../../domain/model/order.types";

export type OrderCollection = Record<string, CustomerOrder[]>;

export interface OrderRepository {
  snapshot(): OrderCollection;
  list(): CustomerOrder[];
  getById(orderId: string): CustomerOrder | undefined;
  replace(orders: OrderCollection): void;
  subscribe(listener: (orders: OrderCollection) => void): () => void;
}
