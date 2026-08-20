import {
  Building2,
  ContactRound,
  CreditCard,
  FileText,
  Handshake,
  Headphones,
  ListTodo,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
  Target,
  Truck,
  UserRoundSearch,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { CrmModuleVisibilityConfig } from "@/platform/workspace-config";

export type ModuleKey = keyof CrmModuleVisibilityConfig;
export type GroupTone = "violet" | "sky" | "amber";

export type ModuleGroup = {
  id: "relationships" | "commercial" | "operations";
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  tone: GroupTone;
  modules: ModuleKey[];
};

export type ModuleMeta = {
  icon: LucideIcon;
  descriptionKey: string;
  scopeKey: string;
};

export const MODULE_GROUPS: readonly ModuleGroup[] = [
  {
    id: "relationships",
    titleKey: "studio.features.groups.relationships.title",
    descriptionKey: "studio.features.groups.relationships.description",
    icon: UsersRound,
    tone: "violet",
    modules: ["leads", "contacts", "organizations", "customers"],
  },
  {
    id: "commercial",
    titleKey: "studio.features.groups.commercial.title",
    descriptionKey: "studio.features.groups.commercial.description",
    icon: Target,
    tone: "sky",
    modules: ["deals", "quotes", "orders", "invoices", "payments"],
  },
  {
    id: "operations",
    titleKey: "studio.features.groups.operations.title",
    descriptionKey: "studio.features.groups.operations.description",
    icon: PackageCheck,
    tone: "amber",
    modules: ["shipping", "returns", "support", "tasks"],
  },
];

export const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  leads: {
    icon: UserRoundSearch,
    descriptionKey: "studio.features.modules.leads.description",
    scopeKey: "studio.features.modules.leads.scope",
  },
  contacts: {
    icon: ContactRound,
    descriptionKey: "studio.features.modules.contacts.description",
    scopeKey: "studio.features.modules.contacts.scope",
  },
  organizations: {
    icon: Building2,
    descriptionKey: "studio.features.modules.organizations.description",
    scopeKey: "studio.features.modules.organizations.scope",
  },
  customers: {
    icon: UsersRound,
    descriptionKey: "studio.features.modules.customers.description",
    scopeKey: "studio.features.modules.customers.scope",
  },
  deals: {
    icon: Handshake,
    descriptionKey: "studio.features.modules.deals.description",
    scopeKey: "studio.features.modules.deals.scope",
  },
  quotes: {
    icon: FileText,
    descriptionKey: "studio.features.modules.quotes.description",
    scopeKey: "studio.features.modules.quotes.scope",
  },
  orders: {
    icon: ShoppingCart,
    descriptionKey: "studio.features.modules.orders.description",
    scopeKey: "studio.features.modules.orders.scope",
  },
  invoices: {
    icon: ReceiptText,
    descriptionKey: "studio.features.modules.invoices.description",
    scopeKey: "studio.features.modules.invoices.scope",
  },
  payments: {
    icon: CreditCard,
    descriptionKey: "studio.features.modules.payments.description",
    scopeKey: "studio.features.modules.payments.scope",
  },
  shipping: {
    icon: Truck,
    descriptionKey: "studio.features.modules.shipping.description",
    scopeKey: "studio.features.modules.shipping.scope",
  },
  returns: {
    icon: RotateCcw,
    descriptionKey: "studio.features.modules.returns.description",
    scopeKey: "studio.features.modules.returns.scope",
  },
  support: {
    icon: Headphones,
    descriptionKey: "studio.features.modules.support.description",
    scopeKey: "studio.features.modules.support.scope",
  },
  tasks: {
    icon: ListTodo,
    descriptionKey: "studio.features.modules.tasks.description",
    scopeKey: "studio.features.modules.tasks.scope",
  },
};

export const GROUP_TONE_CLASSES: Record<GroupTone, { icon: string; count: string }> = {
  violet: { icon: "bg-violet-100 text-violet-700", count: "border-violet-200 bg-violet-50 text-violet-700" },
  sky: { icon: "bg-sky-100 text-sky-700", count: "border-sky-200 bg-sky-50 text-sky-700" },
  amber: { icon: "bg-amber-100 text-amber-700", count: "border-amber-200 bg-amber-50 text-amber-700" },
};

export function normalizeModuleDraft(modules: CrmModuleVisibilityConfig): CrmModuleVisibilityConfig {
  return { ...modules, customers: true };
}
