export type ProductLocale = "vi" | "en";

export type LocalizedProductText = Readonly<{ vi: string; en: string }>;

export const PRODUCT_GLOSSARY = {
  lead: { vi: "Khách hàng tiềm năng", en: "Lead" },
  contact: { vi: "Người liên hệ", en: "Contact" },
  organization: { vi: "Tổ chức", en: "Organization" },
  customer: { vi: "Hồ sơ khách hàng", en: "Customer profile" },
  deal: { vi: "Cơ hội", en: "Deal" },
  quote: { vi: "Báo giá", en: "Quote" },
  order: { vi: "Đơn hàng", en: "Order" },
  payment: { vi: "Thanh toán", en: "Payment" },
  shipping: { vi: "Vận đơn", en: "Shipping" },
  return: { vi: "Đổi / Trả hàng", en: "Return / Exchange" },
  support: { vi: "Phiếu hỗ trợ", en: "Support ticket" },
  task: { vi: "Công việc", en: "Task" },
  owner: { vi: "Người phụ trách", en: "Owner" },
  nextStep: { vi: "Hành động tiếp theo", en: "Next step" },
  readOnly: { vi: "Chỉ xem", en: "Read only" },
} as const satisfies Record<string, LocalizedProductText>;

export type ProductGlossaryKey = keyof typeof PRODUCT_GLOSSARY;

export function productTerm(key: ProductGlossaryKey, locale: ProductLocale): string {
  return PRODUCT_GLOSSARY[key][locale];
}

const BUSINESS_STATUS_LABELS: Readonly<Record<string, LocalizedProductText>> = {
  OPEN: { vi: "Đang mở", en: "Open" },
  ACTIVE: { vi: "Đang hoạt động", en: "Active" },
  INACTIVE: { vi: "Không hoạt động", en: "Inactive" },
  DRAFT: { vi: "Bản nháp", en: "Draft" },
  PENDING: { vi: "Đang chờ", en: "Pending" },
  CONFIRMED: { vi: "Đã xác nhận", en: "Confirmed" },
  COMPLETED: { vi: "Đã hoàn thành", en: "Completed" },
  CANCELLED: { vi: "Đã hủy", en: "Cancelled" },
  CANCELED: { vi: "Đã hủy", en: "Cancelled" },
  CLOSED: { vi: "Đã đóng", en: "Closed" },
  RESOLVED: { vi: "Đã xử lý", en: "Resolved" },
  FAILED: { vi: "Thất bại", en: "Failed" },
  BOOKED: { vi: "Đã tạo vận đơn", en: "Booked" },
  DELIVERED: { vi: "Đã giao", en: "Delivered" },
  DELIVERY_FAILED: { vi: "Giao thất bại", en: "Delivery failed" },
  READY: { vi: "Sẵn sàng", en: "Ready" },
  ACTION: { vi: "Cần xử lý", en: "Action required" },
  NEW: { vi: "Mới", en: "New" },
  IN_PROGRESS: { vi: "Đang xử lý", en: "In progress" },
  WAITING_CUSTOMER: { vi: "Chờ khách hàng", en: "Waiting for customer" },
  WAITING_INTERNAL: { vi: "Chờ nội bộ", en: "Waiting internally" },
  HIGH: { vi: "Cao", en: "High" },
  MEDIUM: { vi: "Trung bình", en: "Medium" },
  LOW: { vi: "Thấp", en: "Low" },
  URGENT: { vi: "Khẩn cấp", en: "Urgent" },
};

function humanizeCode(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase());
}

export function businessStatusLabel(value: string | undefined, locale: ProductLocale): string {
  if (!value) return "—";
  const normalized = value.trim().toUpperCase();
  return BUSINESS_STATUS_LABELS[normalized]?.[locale] ?? humanizeCode(value);
}

export function unresolvedReferenceLabel(kind: "member" | "record", locale: ProductLocale): string {
  if (kind === "member") return locale === "vi" ? "Không tìm thấy thành viên" : "Member not found";
  return locale === "vi" ? "Không tìm thấy bản ghi" : "Record not found";
}
