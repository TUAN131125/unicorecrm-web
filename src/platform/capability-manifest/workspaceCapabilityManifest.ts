import type { CrmWorkspaceConfig } from "@/platform/workspace-config";

export type WorkspaceCapabilityMode =
  | "NATIVE"
  | "EXTERNAL"
  | "READ_ONLY"
  | "HISTORICAL_ONLY"
  | "DISABLED";

export type WorkspaceCapabilityKey =
  | "leads"
  | "contacts"
  | "organizations"
  | "customers"
  | "tasks"
  | "products"
  | "deals"
  | "quotes"
  | "orders"
  | "payments"
  | "invoices"
  | "receivables"
  | "shipping"
  | "returns"
  | "support";

export interface WorkspaceCapabilityEntry {
  key: WorkspaceCapabilityKey;
  mode: WorkspaceCapabilityMode;
  canReadInNativeUi: boolean;
  canWriteInNativeUi: boolean;
  dependencies: WorkspaceCapabilityKey[];
  reasonCodes: string[];
}

export interface WorkspaceCapabilityManifest {
  schemaVersion: 1;
  entries: Record<WorkspaceCapabilityKey, WorkspaceCapabilityEntry>;
}

export function buildWorkspaceCapabilityManifest(config: CrmWorkspaceConfig): WorkspaceCapabilityManifest {
  const native = (
    key: WorkspaceCapabilityKey,
    dependencies: WorkspaceCapabilityKey[] = [],
    visible = true,
  ): WorkspaceCapabilityEntry => ({
    key,
    mode: "NATIVE",
    canReadInNativeUi: visible,
    canWriteInNativeUi: visible,
    dependencies,
    reasonCodes: visible ? [] : ["NATIVE_NAVIGATION_HIDDEN"],
  });
  const optional = (
    key: WorkspaceCapabilityKey,
    enabled: boolean,
    dependencies: WorkspaceCapabilityKey[] = [],
  ): WorkspaceCapabilityEntry => enabled
    ? native(key, dependencies)
    : historical(key, dependencies, "WORKSPACE_CAPABILITY_DISABLED");

  const dealsEnabled = config.modules.deals && config.workflow.dealUsageMode !== "DISABLED";
  const quotesEnabled = config.modules.quotes && config.workflow.quoteUsageMode !== "DISABLED";
  const orderMode = config.workflow.orderMode ?? (config.modules.orders === false ? "EXTERNAL" : "NATIVE");
  const paymentMode = config.workflow.paymentMode ?? (config.modules.payments === false ? "EXTERNAL" : "NATIVE");

  const orders = orderMode === "EXTERNAL"
    ? external("orders", ["contacts"], "ORDER_AUTHORITY_EXTERNAL")
    : optional("orders", config.modules.orders !== false, ["contacts"]);
  const payments = paymentMode === "NONE"
    ? disabled("payments", ["orders"], "PAYMENT_CAPABILITY_NOT_USED")
    : paymentMode === "EXTERNAL"
      ? external("payments", ["orders"], "PAYMENT_AUTHORITY_EXTERNAL")
      : optional("payments", config.modules.payments !== false, ["orders"]);
  const invoices = optional("invoices", config.modules.invoices !== false, ["orders"]);

  const entries: Record<WorkspaceCapabilityKey, WorkspaceCapabilityEntry> = {
    leads: native("leads", [], config.modules.leads),
    contacts: native("contacts", [], config.modules.contacts),
    organizations: optional("organizations", config.modules.organizations !== false),
    customers: native("customers", ["contacts"], config.modules.customers !== false),
    tasks: native("tasks", [], config.modules.tasks !== false),
    products: native("products"),
    deals: dealsEnabled
      ? native("deals", ["contacts"])
      : historical("deals", ["contacts"], "DEAL_PATH_DISABLED"),
    quotes: quotesEnabled
      ? native("quotes", ["contacts"])
      : historical("quotes", ["contacts"], "QUOTE_PATH_DISABLED"),
    orders,
    payments,
    invoices,
    receivables: {
      ...invoices,
      key: "receivables",
      dependencies: ["invoices"],
    },
    shipping: optional("shipping", config.modules.shipping !== false, ["orders"]),
    returns: optional("returns", config.modules.returns !== false, ["orders"]),
    support: optional("support", Boolean(config.modules.support), ["contacts"]),
  };

  return { schemaVersion: 1, entries };
}

export function getWorkspaceCapability(
  manifest: WorkspaceCapabilityManifest,
  key: WorkspaceCapabilityKey,
): WorkspaceCapabilityEntry {
  return manifest.entries[key];
}

function historical(
  key: WorkspaceCapabilityKey,
  dependencies: WorkspaceCapabilityKey[],
  reasonCode: string,
): WorkspaceCapabilityEntry {
  return {
    key,
    mode: "HISTORICAL_ONLY",
    canReadInNativeUi: false,
    canWriteInNativeUi: false,
    dependencies,
    reasonCodes: [reasonCode],
  };
}

function external(
  key: WorkspaceCapabilityKey,
  dependencies: WorkspaceCapabilityKey[],
  reasonCode: string,
): WorkspaceCapabilityEntry {
  return {
    key,
    mode: "EXTERNAL",
    canReadInNativeUi: false,
    canWriteInNativeUi: false,
    dependencies,
    reasonCodes: [reasonCode],
  };
}

function disabled(
  key: WorkspaceCapabilityKey,
  dependencies: WorkspaceCapabilityKey[],
  reasonCode: string,
): WorkspaceCapabilityEntry {
  return {
    key,
    mode: "DISABLED",
    canReadInNativeUi: false,
    canWriteInNativeUi: false,
    dependencies,
    reasonCodes: [reasonCode],
  };
}
