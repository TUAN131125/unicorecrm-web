import React from "react";
import { Badge } from "@/shared/components/ui";
import type { CustomerHealth, CustomerHealthBand, CustomerStatus, CustomerType } from "../../domain/model/customer.types";

const statusLabels: Record<CustomerStatus, { vi: string; en: string }> = {
  NEW: { vi: "Mới", en: "New" },
  ACTIVE: { vi: "Đang hoạt động", en: "Active" },
  AT_RISK: { vi: "Có rủi ro", en: "At risk" },
  INACTIVE: { vi: "Không hoạt động", en: "Inactive" },
  CHURNED: { vi: "Đã rời bỏ", en: "Churned" },
  DO_NOT_CONTACT: { vi: "Không liên hệ", en: "Do not contact" },
  ARCHIVED: { vi: "Đã lưu trữ", en: "Archived" },
};

export const CustomerStatusBadge: React.FC<{ status: CustomerStatus; locale?: "vi" | "en" }> = ({ status, locale = "vi" }) => (
  <Badge variant={status === "ACTIVE" || status === "NEW" ? "success" : status === "AT_RISK" ? "warning" : status === "CHURNED" || status === "DO_NOT_CONTACT" ? "danger" : "neutral"} className="whitespace-nowrap">
    {statusLabels[status][locale]}
  </Badge>
);

export const CustomerHealthBadge: React.FC<{ health: CustomerHealth | CustomerHealthBand | null; locale?: "vi" | "en" }> = ({ health, locale = "vi" }) => (
  <Badge variant={health === "GOOD" || health === "HEALTHY" ? "success" : health === "WATCH" || health === "AT_RISK" ? "warning" : health === "RISK" || health === "CRITICAL" ? "danger" : "neutral"} className="whitespace-nowrap">
    {health === null || health === "UNKNOWN"
      ? (locale === "vi" ? "Chưa đủ dữ liệu" : "Unknown")
      : locale === "vi"
        ? ({ GOOD: "Tốt", HEALTHY: "Khỏe mạnh", WATCH: "Theo dõi", RISK: "Rủi ro", AT_RISK: "Có rủi ro", CRITICAL: "Nghiêm trọng" } as const)[health]
        : ({ GOOD: "Good", HEALTHY: "Healthy", WATCH: "Watch", RISK: "Risk", AT_RISK: "At risk", CRITICAL: "Critical" } as const)[health]}
  </Badge>
);

export const CustomerTypeBadge: React.FC<{ type: CustomerType }> = ({ type }) => <Badge variant="info">{type}</Badge>;
