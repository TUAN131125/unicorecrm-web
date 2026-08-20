import {
  createModuleCollectionResource,
  createModuleDetailResource,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import { projectOrderReadModel, type OrderReadModel } from "../read-models/orderReadModel";
import { replaceOrderList, saveOrderSnapshot } from "../../public/orders";

const collection = createModuleCollectionResource<OrderReadModel>("orders", {
  project: (records) => replaceOrderList(records.map(projectOrderReadModel)),
});
const details = new Map<string, AuthoritativeResource<OrderReadModel>>();

export function getOrderCollectionResource(): AuthoritativeResource<AuthoritativePage<OrderReadModel>> {
  return collection;
}

export function getOrderDetailResource(orderId: string): AuthoritativeResource<OrderReadModel> {
  let resource = details.get(orderId);
  if (!resource) {
    resource = createModuleDetailResource("orders", orderId, (record: OrderReadModel) => { saveOrderSnapshot(projectOrderReadModel(record)); });
    details.set(orderId, resource);
  }
  return resource;
}
