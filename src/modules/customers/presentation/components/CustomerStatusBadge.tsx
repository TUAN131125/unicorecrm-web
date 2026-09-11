import React from "react";
import { Badge } from "@/shared/components/ui";
import type { CustomerHealth, CustomerStatus, CustomerType } from "../../domain/model/customer.types";

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

export const CustomerHealthBadge: React.FC<{ health: CustomerHealth | null; locale?: "vi" | "en" }> = ({ health, locale = "vi" }) => (
  <Badge variant={health === "GOOD" ? "success" : health === "WATCH" ? "warning" : health === "RISK" ? "danger" : "neutral"} className="whitespace-nowrap">
    {health === null ? (locale === "vi" ? "Chưa có" : "Unknown") : locale === "vi" ? (health === "GOOD" ? "Tốt" : health === "WATCH" ? "Theo dõi" : "Rủi ro") : (health === "GOOD" ? "Good" : health === "WATCH" ? "Watch" : "Risk")}
  </Badge>
);

export const CustomerTypeBadge: React.FC<{ type: CustomerType }> = ({ type }) => <Badge variant="info">{type}</Badge>;
