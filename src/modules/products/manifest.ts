import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const PRODUCT_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "products",
  workspace: "crm",
  routes: [
    { id: "products.list", path: ROUTE_KEYS.CATALOG },
    { id: "products.detail", path: ROUTE_KEYS.PRODUCT_DETAIL },
  ],
  navigation: [
    {
      id: "products.catalog",
      path: ROUTE_KEYS.CATALOG,
      labelKey: "catalog.title",
      order: 40,
    },
  ],
};
