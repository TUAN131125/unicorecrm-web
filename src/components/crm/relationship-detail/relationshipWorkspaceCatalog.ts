export type RelationshipWorkspaceItemId =
  | "profile"
  | "people"
  | "notes"
  | "opportunities"
  | "quotations"
  | "orders"
  | "invoices"
  | "payments"
  | "shipping"
  | "returns"
  | "products"
  | "history"
  | "support"
  | "tasks"
  | "activities";

export const RELATIONSHIP_WORKSPACE_ORDER = {
  relationship: ["profile", "people", "notes"] as const,
  sales: ["opportunities", "quotations"] as const,
  transactions: ["orders", "invoices", "payments", "shipping", "returns", "products", "history"] as const,
  service: ["support"] as const,
  work: ["tasks", "activities"] as const,
};

const LABELS: Record<RelationshipWorkspaceItemId, { vi: string; en: string }> = {
  profile: { vi: "Hồ sơ", en: "Profile" },
  people: { vi: "Liên kết", en: "Connections" },
  notes: { vi: "Ghi chú", en: "Notes" },
  opportunities: { vi: "Cơ hội", en: "Opportunities" },
  quotations: { vi: "Báo giá", en: "Quotes" },
  orders: { vi: "Đơn hàng", en: "Orders" },
  invoices: { vi: "Hóa đơn", en: "Invoices" },
  payments: { vi: "Thanh toán & công nợ", en: "Payments & receivables" },
  shipping: { vi: "Vận đơn", en: "Shipping" },
  returns: { vi: "Đổi / Trả", en: "Returns" },
  products: { vi: "Hàng đã mua", en: "Purchased items" },
  history: { vi: "Lịch sử mua", en: "Purchase history" },
  support: { vi: "Phiếu hỗ trợ", en: "Support cases" },
  tasks: { vi: "Công việc", en: "Tasks" },
  activities: { vi: "Hoạt động", en: "Activities" },
};

export function relationshipWorkspaceLabel(id: RelationshipWorkspaceItemId, isVi: boolean): string {
  return LABELS[id][isVi ? "vi" : "en"];
}
