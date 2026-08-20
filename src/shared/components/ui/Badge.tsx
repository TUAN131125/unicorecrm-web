import React from "react";
import { cn } from "../../lib/classnames/cn";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "secondary" | "indigo" | "purple" | (string & {});

export interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  size?: "xs" | "sm" | "md";
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  className,
  size = "sm",
  children,
}) => {
  const variantClasses = {
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    danger: "bg-rose-50 text-rose-700 border border-rose-200",
    info: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
    secondary: "bg-slate-50 text-slate-600 border border-slate-200",
    indigo: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    purple: "bg-purple-50 text-purple-700 border border-purple-200",
  };

  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-[9px]",
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };
  const resolvedVariantClass = variantClasses[variant as keyof typeof variantClasses] ?? variant;

  return (
    <span
      data-ui-badge="true"
      className={cn(
        "inline-flex items-center rounded-full font-semibold tracking-normal shrink-0",
        sizeClasses[size],
        resolvedVariantClass,
        className
      )}
    >
      {children}
    </span>
  );
};

export const getDealStageBadgeVariant = (stage: string): BadgeVariant => {
  const s = String(stage || "").trim().toUpperCase();
  if (s === "CHƯA PHÂN LOẠI" || s === "UNCLASS" || s === "COLD") return "neutral";
  if (s === "DISCOVERY" || s === "QUALIFIED" || s === "SOLUTION") return "info";
  if (s === "NEW" || s === "MỞ" || s === "LIÊN HỆ" || s === "TIẾP CẬN" || s === "QUALIFICATION" || s === "ĐÁNH GIÁ" || s === "STG_NEW" || s === "STG_CONTACTED") return "info";
  if (s === "PROPOSAL" || s === "BÁO GIÁ" || s === "NEGOTIATION" || s === "THƯƠNG LƯỢNG" || s === "STG_DEMO" || s === "STG_PROPOSAL") return "warning";
  if (s === "WON" || s === "THÀNH CÔNG" || s === "ĐẰNG SAU" || s === "CLOSED_WON" || s === "STG_WON") return "success";
  if (s === "LOST" || s === "THẤT BẠI" || s === "CLOSED_LOST" || s === "STG_LOST") return "danger";
  return "neutral";
};

export const getQuoteStatusBadgeVariant = (status: string): BadgeVariant => {
  const s = String(status || "").trim().toUpperCase();
  if (s === "NHÁP" || s === "DRAFT") return "neutral";
  if (s === "REVIEW" || s === "CHỜ DUYỆT" || s === "PENDING_APPROVAL" || s === "PENDING") return "warning";
  if (s === "ĐÃ DUYỆT" || s === "APPROVED" || s === "ĐÃ GỬI" || s === "SENT") return "info";
  if (s === "ĐÃ CHẤP NHẬN" || s === "ACCEPTED") return "success";
  if (s === "ĐÃ TỪ CHỐI" || s === "REJECTED" || s === "HẾT HẠN" || s === "EXPIRED") return "danger";
  return "neutral";
};

export const getCustomerHealthBadgeVariant = (health: string): BadgeVariant => {
  const s = String(health || "").trim().toUpperCase();
  if (s === "GREEN" || s === "TỐT" || s === "KHỎE" || s === "KHỎE MẠNH") return "success";
  if (s === "YELLOW" || s === "TRUNG BÌNH" || s === "CẢNH BÁO" || s === "CÓ RỦI RO") return "warning";
  if (s === "RED" || s === "YẾU" || s === "NGUY HIỂM" || s === "RẤT NGUY HIỂM") return "danger";
  return "neutral";
};

export const getSupportPriorityBadgeVariant = (priority: string): BadgeVariant => {
  const s = String(priority || "").trim().toUpperCase();
  if (s === "HIGHEST" || s === "CRITICAL" || s === "KHẨN CẤP") return "danger";
  if (s === "HIGH" || s === "CAO") return "warning";
  if (s === "MEDIUM" || s === "TRUNG BÌNH" || s === "NORMAL" || s === "BÌNH THƯỜNG") return "info";
  if (s === "LOW" || s === "THẤP") return "neutral";
  return "neutral";
};

export const getSupportCaseStatusBadgeVariant = (status: string): BadgeVariant => {
  const s = String(status || "").trim().toUpperCase();
  if (s === "DISCOVERY" || s === "QUALIFIED" || s === "SOLUTION") return "info";
  if (s === "NEW" || s === "MỚI") return "info";
  if (s === "IN_PROGRESS" || s === "ĐANG XỬ LÝ" || s === "IN-PROGRESS") return "warning";
  if (s === "PENDING_DEV" || s === "ĐỢI PHẢN HỒI TỪ DEV" || s === "PENDING-DEV") return "warning";
  if (s === "RESOLVED" || s === "ĐÃ GIẢI QUYẾT") return "success";
  if (s === "CLOSED" || s === "ĐÓNG CASE") return "neutral";
  return "neutral";
};

export const getOnboardingStatusBadgeVariant = (status: string): BadgeVariant => {
  const s = String(status || "").trim().toUpperCase();
  if (s === "CHƯA BẮT ĐẦU" || s === "NOT_STARTED") return "neutral";
  if (s === "HOÀN THÀNH" || s === "COMPLETED") return "success";
  return "info"; // Default for active onboarding stages
};
