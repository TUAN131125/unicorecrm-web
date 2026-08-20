import { 
  SupportCaseStatus, 
  SupportCasePriority, 
  SupportCaseCategory, 
  SupportCaseSource 
} from "../model/supportCase.types";

export interface ConfigItem<T extends string> {
  value: T;
  labelVi: string;
  labelEn: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const SUPPORT_CASE_STATUS_CONFIG: Record<SupportCaseStatus, ConfigItem<SupportCaseStatus>> = {
  new: {
    value: "new",
    labelVi: "Mới",
    labelEn: "New",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  in_progress: {
    value: "in_progress",
    labelVi: "Đang xử lý",
    labelEn: "In progress",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200"
  },
  waiting_customer: {
    value: "waiting_customer",
    labelVi: "Chờ khách hàng",
    labelEn: "Waiting customer",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200"
  },
  waiting_internal: {
    value: "waiting_internal",
    labelVi: "Chờ nội bộ",
    labelEn: "Waiting internal",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200"
  },
  resolved: {
    value: "resolved",
    labelVi: "Đã giải quyết",
    labelEn: "Resolved",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200"
  },
  closed: {
    value: "closed",
    labelVi: "Đã đóng",
    labelEn: "Closed",
    color: "text-slate-500",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300"
  },
  reopened: {
    value: "reopened",
    labelVi: "Mở lại",
    labelEn: "Reopened",
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200"
  },
  cancelled: {
    value: "cancelled",
    labelVi: "Đã hủy",
    labelEn: "Cancelled",
    color: "text-slate-400",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-100"
  }
};

export const SUPPORT_CASE_PRIORITY_CONFIG: Record<SupportCasePriority, ConfigItem<SupportCasePriority>> = {
  low: {
    value: "low",
    labelVi: "Thấp",
    labelEn: "Low",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-200"
  },
  medium: {
    value: "medium",
    labelVi: "Trung bình",
    labelEn: "Medium",
    color: "text-blue-600",
    bgColor: "bg-blue-50/50",
    borderColor: "border-blue-100"
  },
  high: {
    value: "high",
    labelVi: "Cao",
    labelEn: "High",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200"
  },
  critical: {
    value: "critical",
    labelVi: "Khẩn cấp",
    labelEn: "Critical",
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200"
  }
};

export const SUPPORT_CASE_CATEGORY_CONFIG: Record<SupportCaseCategory, Omit<ConfigItem<SupportCaseCategory>, "color" | "bgColor" | "borderColor">> = {
  request: { value: "request", labelVi: "Yêu cầu", labelEn: "Request" },
  consultation: { value: "consultation", labelVi: "Tư vấn", labelEn: "Consultation" },
  complaint: { value: "complaint", labelVi: "Khiếu nại", labelEn: "Complaint" },
  follow_up: { value: "follow_up", labelVi: "Chăm sóc theo dõi", labelEn: "Follow-up care" },
  onboarding: { value: "onboarding", labelVi: "Onboarding", labelEn: "Onboarding" },
  usage_issue: { value: "usage_issue", labelVi: "Vấn đề sử dụng", labelEn: "Usage issue" },
  post_purchase: { value: "post_purchase", labelVi: "Chăm sóc sau mua", labelEn: "Post-purchase care" },
  technical_support: { value: "technical_support", labelVi: "Vấn đề sử dụng", labelEn: "Usage issue" },
  warranty: { value: "warranty", labelVi: "Chăm sóc sau mua", labelEn: "Post-purchase care" },
  customer_care: { value: "customer_care", labelVi: "Chăm sóc theo dõi", labelEn: "Follow-up care" },
  billing: { value: "billing", labelVi: "Yêu cầu thanh toán", labelEn: "Billing request" },
  feature_request: { value: "feature_request", labelVi: "Yêu cầu", labelEn: "Request" },
};

export const SUPPORT_CASE_SOURCE_CONFIG: Record<SupportCaseSource, { value: SupportCaseSource; labelVi: string; labelEn: string }> = {
  manual: { value: "manual", labelVi: "Thủ công", labelEn: "Manual" },
  customer_360: { value: "customer_360", labelVi: "Customer 360", labelEn: "Customer 360" },
  email: { value: "email", labelVi: "Email", labelEn: "Email" },
  phone: { value: "phone", labelVi: "Điện thoại", labelEn: "Phone" },
  chat: { value: "chat", labelVi: "Trò chuyện", labelEn: "Chat" },
  web_form: { value: "web_form", labelVi: "Biểu mẫu Web", labelEn: "Web form" },
  order: { value: "order", labelVi: "Đơn hàng", labelEn: "Order" },
  product: { value: "product", labelVi: "Sản phẩm", labelEn: "Product" }
};

export interface SlaRule {
  priority: SupportCasePriority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  firstResponseLabel: string;
  resolutionLabel: string;
}

export const SUPPORT_CASE_SLA_RULES: Record<SupportCasePriority, SlaRule> = {
  critical: {
    priority: "critical",
    firstResponseMinutes: 30,
    resolutionMinutes: 240, // 4 hours
    firstResponseLabel: "30 phút",
    resolutionLabel: "4 giờ"
  },
  high: {
    priority: "high",
    firstResponseMinutes: 60,
    resolutionMinutes: 480, // 8 hours
    firstResponseLabel: "1 giờ",
    resolutionLabel: "8 giờ"
  },
  medium: {
    priority: "medium",
    firstResponseMinutes: 240, // 4 hours
    resolutionMinutes: 1440, // 24 hours
    firstResponseLabel: "4 giờ",
    resolutionLabel: "24 giờ"
  },
  low: {
    priority: "low",
    firstResponseMinutes: 1440, // 1 business day (24h)
    resolutionMinutes: 4320, // 3 business days (72h)
    firstResponseLabel: "1 ngày làm việc",
    resolutionLabel: "3 ngày làm việc"
  }
};
