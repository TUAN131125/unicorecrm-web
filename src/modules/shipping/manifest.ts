import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";
export const SHIPPING_MODULE_MANIFEST: FrontendModuleManifest = { key: "shipping", workspace: "crm", routes: [{ id: "shipping.list", path: ROUTE_KEYS.SHIPPING }, { id: "shipping.create", path: ROUTE_KEYS.SHIPPING_NEW }, { id: "shipping.detail", path: ROUTE_KEYS.SHIPPING_DETAIL }], navigation: [{ id: "shipping", path: ROUTE_KEYS.SHIPPING, labelKey: "nav.shipping", order: 85 }] };
