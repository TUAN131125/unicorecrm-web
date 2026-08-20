import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const INVOICE_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "invoices",
  workspace: "crm",
  routes: [
    { id: "invoices.list", path: ROUTE_KEYS.INVOICES },
    { id: "invoices.create", path: ROUTE_KEYS.INVOICE_NEW },
    { id: "invoices.detail", path: ROUTE_KEYS.INVOICE_DETAIL },
    { id: "invoices.edit", path: ROUTE_KEYS.INVOICE_EDIT },
    { id: "receivables.list", path: ROUTE_KEYS.RECEIVABLES },
    { id: "receivables.detail", path: ROUTE_KEYS.RECEIVABLE_DETAIL },
    { id: "receivables.statement", path: ROUTE_KEYS.ACCOUNT_STATEMENT },
  ],
  navigation: [
    { id: "invoices", path: ROUTE_KEYS.INVOICES, labelKey: "nav.invoices", order: 82 },
    { id: "receivables", path: ROUTE_KEYS.RECEIVABLES, labelKey: "nav.receivables", order: 83 },
  ],
};
