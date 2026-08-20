import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const SUPPORT_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "support",
  workspace: "crm",
  routes: [
    { id: "support.cases.list", path: ROUTE_KEYS.SUPPORT_CASES },
    { id: "support.cases.new", path: ROUTE_KEYS.SUPPORT_CASE_NEW },
    { id: "support.cases.detail", path: ROUTE_KEYS.SUPPORT_CASE_DETAIL },
    { id: "support.cases.edit", path: ROUTE_KEYS.SUPPORT_CASE_EDIT },
  ],
  navigation: [
    {
      id: "support.cases",
      path: ROUTE_KEYS.SUPPORT_CASES,
      labelKey: "support.title",
      order: 80,
    },
  ],
};
