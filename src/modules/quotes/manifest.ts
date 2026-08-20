import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const QUOTE_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "quotes",
  workspace: "crm",
  routes: [
    { id: "quotes.list", path: ROUTE_KEYS.QUOTES },
    { id: "quotes.new", path: ROUTE_KEYS.QUOTE_NEW },
    { id: "quotes.detail", path: ROUTE_KEYS.QUOTE_DETAIL },
    { id: "quotes.edit", path: ROUTE_KEYS.QUOTE_EDIT },
    { id: "quotes.builderLegacy", path: ROUTE_KEYS.QUOTE_BUILDER_LEGACY },
  ],
  navigation: [
    { id: "quotes", path: ROUTE_KEYS.QUOTES, labelKey: "nav.quotes", order: 50 },
  ],
};
