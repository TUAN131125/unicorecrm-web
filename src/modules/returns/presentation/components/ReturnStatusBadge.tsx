import React from "react";
import { Badge } from "@/shared/components/ui";
import type { ReturnStatus } from "../../domain/model/return.types";

const label: Record<ReturnStatus, string> = { REQUESTED: "ĐÃ YÊU CẦU", APPROVED: "ĐÃ DUYỆT", AWAITING_ITEM: "CHỜ HÀNG", RECEIVED: "ĐÃ NHẬN", RESOLVED: "ĐÃ XỬ LÝ", CLOSED: "ĐÃ ĐÓNG", REJECTED: "TỪ CHỐI" };
const tone: Record<ReturnStatus, "neutral" | "warning" | "success" | "danger" | "info"> = { REQUESTED: "info", APPROVED: "success", AWAITING_ITEM: "warning", RECEIVED: "info", RESOLVED: "success", CLOSED: "neutral", REJECTED: "danger" };
export const ReturnStatusBadge: React.FC<{ status: ReturnStatus }> = ({ status }) => <Badge variant={tone[status]} size="xs" className="whitespace-nowrap font-medium tracking-wide">{label[status]}</Badge>;
