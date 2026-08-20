import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const CUSTOMER_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "customers",
  workspace: "crm",
  routes: [
    { id: "customers.list", path: ROUTE_KEYS.CUSTOMERS },
    { id: "customers.detail", path: ROUTE_KEYS.CUSTOMER_DETAIL },
    { id: "customers.segments", path: ROUTE_KEYS.CUSTOMER_SEGMENTS },
    { id: "customers.health", path: ROUTE_KEYS.CUSTOMER_HEALTH },
  ],
  navigation: [{ id: "customers", path: ROUTE_KEYS.CUSTOMERS, labelKey: "customerList.title", order: 40 }],
};
