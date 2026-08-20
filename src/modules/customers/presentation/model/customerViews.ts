import type { ReactNode } from "react";

export interface CustomerSystemView {
  key: string;
  labelVi: string;
  labelEn: string;
  isShared: true;
  icon?: ReactNode;
}

export const CUSTOMER_SAVED_VIEWS: CustomerSystemView[] = [
  { key: "allCustomers", labelVi: "Tất cả khách hàng", labelEn: "All customers", isShared: true },
  { key: "myCustomers", labelVi: "Khách hàng của tôi", labelEn: "My customers", isShared: true },
  { key: "b2b", labelVi: "Khách hàng B2B", labelEn: "B2B customers", isShared: true },
  { key: "b2c", labelVi: "Khách hàng B2C", labelEn: "B2C customers", isShared: true },
  { key: "active", labelVi: "Đang hoạt động", labelEn: "Active customers", isShared: true },
  { key: "atRisk", labelVi: "Có rủi ro", labelEn: "At risk", isShared: true },
  { key: "needCareToday", labelVi: "Cần chăm sóc hôm nay", labelEn: "Care due today", isShared: true },
  { key: "overdueCare", labelVi: "Chăm sóc quá hạn", labelEn: "Overdue care", isShared: true },
  { key: "openOpportunity", labelVi: "Có cơ hội đang mở", labelEn: "Open opportunities", isShared: true },
  { key: "openSupport", labelVi: "Có hỗ trợ đang mở", labelEn: "Open support", isShared: true },
  { key: "archived", labelVi: "Đã lưu trữ", labelEn: "Archived", isShared: true },
];
