import type { CustomerListRow } from "./customerList.types";

const COLUMN_LABELS: Record<string, { vi: string; en: string }> = {
  code: { vi: "Mã KH", en: "Code" },
  customer: { vi: "Khách hàng", en: "Customer" },
  primaryContact: { vi: "Liên hệ chính", en: "Primary contact" },
  phone: { vi: "Số điện thoại", en: "Phone" },
  email: { vi: "Email", en: "Email" },
  status: { vi: "Trạng thái", en: "Status" },
  health: { vi: "Sức khỏe", en: "Health" },
  type: { vi: "Loại", en: "Type" },
  segment: { vi: "Phân khúc", en: "Segment" },
  owner: { vi: "Phụ trách", en: "Owner" },
  revenue: { vi: "Tổng chi tiêu", en: "Revenue" },
  orders: { vi: "Đơn hàng", en: "Orders" },
  openDeals: { vi: "Cơ hội mở", en: "Open deals" },
  openWork: { vi: "Việc mở", en: "Open work" },
  openSupport: { vi: "Hỗ trợ mở", en: "Open support" },
  lastPurchase: { vi: "Mua gần nhất", en: "Last purchase" },
  nextCare: { vi: "Chăm sóc tiếp", en: "Next care" },
};

export function customerColumnLabel(column: string, isVi: boolean): string {
  const entry = COLUMN_LABELS[column];
  return entry ? (isVi ? entry.vi : entry.en) : column;
}

export function customerSourceIdentityPath(row: CustomerListRow): string {
  return row.customer.relationshipRef.type === "CONTACT"
    ? `/contacts/${row.customer.relationshipRef.id}`
    : `/organizations/${row.customer.relationshipRef.id}`;
}

export function formatCustomerDate(value: string | undefined, isVi: boolean): string {
  return value ? new Date(value).toLocaleDateString(isVi ? "vi-VN" : "en-US") : "—";
}

export function formatCustomerCurrency(value: number, isVi: boolean): string {
  return `${value.toLocaleString(isVi ? "vi-VN" : "en-US")} ₫`;
}
