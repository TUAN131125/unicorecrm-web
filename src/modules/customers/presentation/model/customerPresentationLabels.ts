const labels: Record<string, [string, string]> = {
  B2B: ["Doanh nghiệp", "Business"], B2C: ["Cá nhân", "Individual"],
  STANDARD: ["Tiêu chuẩn", "Standard"], SILVER: ["Bạc", "Silver"], GOLD: ["Vàng", "Gold"], PLATINUM: ["Bạch kim", "Platinum"], STRATEGIC: ["Chiến lược", "Strategic"],
  BASIC: ["Cơ bản", "Basic"], PRIORITY: ["Ưu tiên", "Priority"], PREMIUM: ["Cao cấp", "Premium"], VIP: ["Đặc biệt", "VIP"],
  NOT_STARTED: ["Chưa bắt đầu", "Not started"], IN_PROGRESS: ["Đang thực hiện", "In progress"], COMPLETED: ["Hoàn thành", "Completed"],
  NONE: ["Chưa có", "None"], LOW: ["Thấp", "Low"], MEDIUM: ["Trung bình", "Medium"], HIGH: ["Cao", "High"],
  primary_contact: ["Liên hệ chính", "Primary contact"], decision_maker: ["Người quyết định", "Decision maker"],
  billing_contact: ["Liên hệ thanh toán", "Billing contact"], technical_contact: ["Liên hệ kỹ thuật", "Technical contact"],
};

export function customerPresentationLabel(value: string | number | null | undefined, vi: boolean): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return String(value);
  const entry = labels[value];
  if (entry) return entry[vi ? 0 : 1];
  if (/^[A-Z][A-Z_]+$/.test(value)) return vi ? "Chưa có nhãn hiển thị" : "Display label unavailable";
  return value;
}

export const customerBusinessTags = (tags: readonly string[]) => tags.filter(tag => tag !== "SYNTHETIC_DEMO");
