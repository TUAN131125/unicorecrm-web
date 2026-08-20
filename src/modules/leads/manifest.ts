import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const LEAD_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "leads",
  workspace: "crm",
  routes: [
    { id: "leads.list", path: ROUTE_KEYS.LEADS },
    { id: "leads.queue", path: ROUTE_KEYS.LEADS_QUEUE },
    { id: "leads.detail", path: ROUTE_KEYS.LEAD_DETAIL },
    { id: "leads.qualify", path: ROUTE_KEYS.LEAD_QUALIFY },
    { id: "leads.sell-now", path: ROUTE_KEYS.LEAD_SELL_NOW },
    { id: "leads.convert-legacy", path: ROUTE_KEYS.LEAD_CONVERT },
  ],
  navigation: [
    {
      id: "leads",
      path: ROUTE_KEYS.LEADS,
      labelKey: "nav.leads",
      order: 20,
    },
  ],
};
