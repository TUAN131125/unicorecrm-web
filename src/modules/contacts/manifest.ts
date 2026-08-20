import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const CONTACT_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "contacts",
  workspace: "crm",
  routes: [
    { id: "contacts.list", path: ROUTE_KEYS.CONTACTS },
    { id: "contacts.detail", path: ROUTE_KEYS.CONTACT_DETAIL },
  ],
  navigation: [
    {
      id: "contacts",
      path: ROUTE_KEYS.CONTACTS,
      labelKey: "nav.contacts",
      order: 30,
    },
  ],
};
