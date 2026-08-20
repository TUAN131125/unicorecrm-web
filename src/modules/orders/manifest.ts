import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const ORDER_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "orders",
  workspace: "crm",
  routes: [
    { id: "orders.list", path: ROUTE_KEYS.ORDERS },
    { id: "orders.new", path: ROUTE_KEYS.ORDER_NEW },
    { id: "orders.detail", path: ROUTE_KEYS.ORDER_DETAIL },
    { id: "orders.edit", path: ROUTE_KEYS.ORDER_EDIT },
  ],
  navigation: [{ id: "orders", path: ROUTE_KEYS.ORDERS, labelKey: "nav.orders", order: 60 }],
};
