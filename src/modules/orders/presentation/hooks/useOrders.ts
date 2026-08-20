import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CustomerOrder } from "../../domain/model/order.types";
import type { OrderCollection } from "../../application/ports/OrderRepository";
import { getOrderCollectionResource } from "../../application/vertical-slice/orderAuthoritativeQueries";
import { getOrdersSnapshot, replaceOrders, subscribeToOrders } from "../../public/orders";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useOrders(options: { loadAuthoritative?: boolean } = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const [orders, setOrders] = useState<OrderCollection>(() => getOrdersSnapshot());
  const query = useModuleAuthoritativeResource(getOrderCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceOrders({}),
  });
  useEffect(() => subscribeToOrders(setOrders), []);
  return { orders, query };
}

export function useOrderCompatibilitySetter(): Dispatch<SetStateAction<Record<string, CustomerOrder[]>>> {
  return (updater) => {
    const current = getOrdersSnapshot();
    replaceOrders(typeof updater === "function" ? updater(current) : updater);
  };
}
