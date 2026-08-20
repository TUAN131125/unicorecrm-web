import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const RETURN_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "returns",
  workspace: "crm",
  routes: [
    { id: "returns.list", path: ROUTE_KEYS.RETURNS },
    { id: "returns.new", path: ROUTE_KEYS.RETURN_NEW },
    { id: "returns.detail", path: ROUTE_KEYS.RETURN_DETAIL },
  ],
  navigation: [{ id: "returns", path: ROUTE_KEYS.RETURNS, labelKey: "nav.returns", order: 92 }],
};
