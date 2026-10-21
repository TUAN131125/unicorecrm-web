import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";
export const COMMUNICATIONS_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "communications",
  workspace: "crm",
  routes: [
    { id: "communications.list", path: ROUTE_KEYS.COMMUNICATIONS },
    { id: "communications.detail", path: ROUTE_KEYS.COMMUNICATION_DETAIL },
  ],
  navigation: [{ id: "communications", path: ROUTE_KEYS.COMMUNICATIONS, labelKey: "communications.inbox", order: 13 }],
};
