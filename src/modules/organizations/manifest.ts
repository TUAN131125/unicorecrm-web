import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const ORGANIZATION_ACCOUNT_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "organizations",
  workspace: "crm",
  routes: [
    { id: "organizations.list", path: ROUTE_KEYS.ORGANIZATIONS },
    { id: "organizations.detail", path: ROUTE_KEYS.ORGANIZATION_DETAIL },
  ],
  navigation: [{ id: "organizations", path: ROUTE_KEYS.ORGANIZATIONS, labelKey: "nav.organizations", order: 52 }],
};
