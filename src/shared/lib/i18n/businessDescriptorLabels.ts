const VIETNAMESE_BUSINESS_DESCRIPTORS: Record<string, string> = {
  Enterprise: "Doanh nghiệp",
  Retail: "Bán lẻ",
  Standard: "Tiêu chuẩn",
  "Key Account": "Khách hàng trọng điểm",
  Logistics: "Vận tải & logistics",
  "Renewal Critical": "Cần ưu tiên gia hạn",
  "Active Customer": "Khách hàng đang hoạt động",
  "B2C Loyalty": "Khách hàng thân thiết B2C",
  Finance: "Tài chính",
  "Decision Maker": "Người ra quyết định",
  "Cloud IT": "Hạ tầng đám mây",
  "ERP-Interest": "Quan tâm ERP",
  Evaluator: "Người đánh giá",
  Contracts: "Hợp đồng",
  "Tech Lead": "Trưởng nhóm kỹ thuật",
  "CRM-Upgrade": "Nâng cấp CRM",
  "Individual Investor": "Nhà đầu tư cá nhân",
  "Cold Lead Converted": "Đã chuyển đổi từ tiềm năng lạnh",
  "High Budget": "Ngân sách cao",
  "Ready to Buy": "Sẵn sàng mua",
  Consultant: "Tư vấn",
  Nurturing: "Đang nuôi dưỡng",
  "Corporate Customer": "Khách hàng doanh nghiệp",
  "Deal Won Ref": "Tham chiếu cơ hội thắng",
  Founder: "Nhà sáng lập",
  CEO: "Tổng giám đốc",
  COO: "Giám đốc vận hành",
  CTO: "Giám đốc công nghệ",
  CFO: "Giám đốc tài chính",
  CMO: "Giám đốc tiếp thị",
  "VP of Sales": "Phó giám đốc bán hàng",
  "Sales Manager": "Quản lý bán hàng",
  "Marketing Manager": "Quản lý tiếp thị",
  "IT Director": "Giám đốc CNTT",
  "Head of Accounting": "Trưởng phòng Kế toán",
  "Operations Director": "Giám đốc Vận hành",
  "Finance Director": "Giám đốc Tài chính",
};

export function localizeBusinessDescriptor(value: string | undefined | null, locale: "vi" | "en" | string): string {
  if (!value) return "";
  return locale === "vi" ? (VIETNAMESE_BUSINESS_DESCRIPTORS[value] ?? value) : value;
}

export function localizeBusinessDescriptors(values: readonly string[], locale: "vi" | "en" | string): string[] {
  return values.map((value) => localizeBusinessDescriptor(value, locale));
}
