import {
  createModuleCollectionResource,
  createModuleDetailResource,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { CustomerOrder } from "../../domain/model/order.types";
import { getOrderListSnapshot, replaceOrderList } from "../../public/orders";

// The Order data-authority bridge returns the adapter's already-mapped CustomerOrder.
// Projection must preserve those server values without repricing or demo mutation rules.
const collection = createModuleCollectionResource<CustomerOrder>("orders", {
  project: replaceOrderList,
});
const details = new Map<string, AuthoritativeResource<CustomerOrder>>();

export function getOrderCollectionResource(): AuthoritativeResource<AuthoritativePage<CustomerOrder>> {
  return collection;
}

export function getOrderDetailResource(orderId: string): AuthoritativeResource<CustomerOrder> {
  let resource = details.get(orderId);
  if (!resource) {
    resource = createModuleDetailResource("orders", orderId, (record: CustomerOrder) => {
      replaceOrderList([...getOrderListSnapshot().filter((order) => order.id !== record.id), record]);
    });
    details.set(orderId, resource);
  }
  return resource;
}
