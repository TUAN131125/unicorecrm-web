import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const PAYMENT_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "payments",
  workspace: "crm",
  routes: [
    { id: "payments.list", path: ROUTE_KEYS.PAYMENTS },
    { id: "payments.detail", path: ROUTE_KEYS.PAYMENT_DETAIL },
  ],
  navigation: [{ id: "payments", path: ROUTE_KEYS.PAYMENTS, labelKey: "nav.payments", order: 80 }],
};
