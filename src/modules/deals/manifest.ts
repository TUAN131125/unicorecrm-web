import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const DEAL_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "deals",
  workspace: "crm",
  routes: [
    { id: "deals.pipeline", path: ROUTE_KEYS.DEALS },
    { id: "deals.detail", path: ROUTE_KEYS.DEAL_DETAIL },
  ],
  navigation: [
    { id: "deals", path: ROUTE_KEYS.DEALS, labelKey: "nav.deals", order: 40 },
  ],
};
