import React from "react";
import { Badge } from "@/shared/components/ui";
import type { BookingStatus, ExternalShippingStatus } from "../../domain/model/shipping.types";

const bookingLabel: Record<BookingStatus, string> = { PENDING: "ĐANG TẠO", BOOKED: "ĐÃ ĐẶT", FAILED: "LỖI BOOKING", CANCELLED: "ĐÃ HỦY" };
const externalLabel: Record<ExternalShippingStatus, string> = { UNKNOWN: "CHƯA RÕ", ACCEPTED: "ĐÃ NHẬN", WAITING_PICKUP: "CHỜ LẤY", PICKED_UP: "ĐÃ LẤY", IN_TRANSIT: "ĐANG GIAO", DELIVERED: "ĐÃ GIAO", DELIVERY_FAILED: "GIAO CHƯA THÀNH CÔNG", RETURNED: "HOÀN HÀNG", CANCELLED: "ĐÃ HỦY" };
const tone: Record<string, "neutral" | "warning" | "success" | "danger" | "info"> = { PENDING: "warning", BOOKED: "info", FAILED: "danger", CANCELLED: "neutral", UNKNOWN: "neutral", ACCEPTED: "info", WAITING_PICKUP: "warning", PICKED_UP: "info", IN_TRANSIT: "info", DELIVERED: "success", DELIVERY_FAILED: "warning", RETURNED: "danger" };

export const ShippingBookingStatusBadge: React.FC<{ status: BookingStatus }> = ({ status }) => <Badge variant={tone[status] ?? "neutral"} size="xs" className="whitespace-nowrap font-medium tracking-wide">{bookingLabel[status]}</Badge>;
export const ShippingCarrierStatusBadge: React.FC<{ status: ExternalShippingStatus }> = ({ status }) => <Badge variant={tone[status] ?? "neutral"} size="xs" className="whitespace-nowrap font-medium tracking-wide">{externalLabel[status]}</Badge>;
