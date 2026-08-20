import type { EvidenceItem } from "@/shared/evidence";
import type { ReturnItem, ReturnMethod, ReturnRequest, ReturnResolutionIntent } from "../../domain/model/return.types";

export type LocalizedLabel = { vi: string; en: string };
export type ReturnDetailLocale = "vi" | "en";
export type ReturnDetailText = (vi: string, en: string) => string;

export const resolutionLabel: Record<string, LocalizedLabel> = {
  REFUND: { vi: "Hoàn tiền", en: "Refund" },
  REPLACEMENT: { vi: "Thay thế", en: "Replacement" },
  EXCHANGE: { vi: "Đổi hàng", en: "Exchange" },
  REPAIR: { vi: "Sửa chữa", en: "Repair" },
};

export const reasonLabel: Record<string, LocalizedLabel> = {
  DEFECTIVE: { vi: "Sản phẩm lỗi", en: "Defective product" },
  WRONG_ITEM: { vi: "Giao sai sản phẩm", en: "Wrong item" },
  DAMAGED: { vi: "Hư hỏng khi giao", en: "Damaged in delivery" },
  NOT_AS_DESCRIBED: { vi: "Không đúng mô tả", en: "Not as described" },
  CUSTOMER_CHANGED_MIND: { vi: "Khách hàng thay đổi nhu cầu", en: "Customer changed their mind" },
  OTHER: { vi: "Lý do khác", en: "Other reason" },
};

export const eligibilityReasonLabel: Record<string, LocalizedLabel> = {
  ELIGIBLE: { vi: "Đủ điều kiện tự động", en: "Automatically eligible" },
  MISSING_DELIVERY_EVIDENCE: { vi: "Thiếu bằng chứng giao hàng", en: "Missing delivery evidence" },
  INVALID_DELIVERY_EVIDENCE: { vi: "Bằng chứng giao hàng không hợp lệ", en: "Invalid delivery evidence" },
  RETURN_WINDOW_EXPIRED: { vi: "Đã hết thời hạn đổi/trả", en: "Return window expired" },
  INVALID_QUANTITY: { vi: "Số lượng không hợp lệ", en: "Invalid quantity" },
  QUANTITY_EXCEEDS_REMAINING: { vi: "Số lượng vượt phần còn có thể đổi/trả", en: "Quantity exceeds the returnable balance" },
};

export const methodLabel: Record<ReturnMethod, string> = {
  CARRIER_PICKUP: "Đơn vị vận chuyển đến lấy",
  CUSTOMER_SELF_SHIP: "Khách tự gửi",
  DROP_OFF: "Khách mang tới điểm nhận",
  NO_PHYSICAL_RETURN: "Không cần thu hồi hàng",
};

export const inputClassName = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100";

export function acceptedQuantity(item: ReturnItem): number {
  return item.acceptedQuantity ?? item.approvedQuantity ?? item.requestedQuantity;
}

export function buildReturnEvidenceItems(request: ReturnRequest, intents: ReturnResolutionIntent[], text: ReturnDetailText): EvidenceItem[] {
  return [
    ...(request.deliveryEvidenceShippingBookingId && request.deliveredAt ? [{
      id: `delivery:${request.deliveryEvidenceShippingBookingId}`,
      type: "DELIVERY_POD" as const,
      externalReference: request.deliveryEvidenceShippingBookingId,
      capturedAt: request.deliveredAt,
      capturedBy: "shipping",
      verificationState: "VERIFIED" as const,
      notes: text("Bằng chứng giao hàng nguồn của Return.", "Source delivery evidence for the Return."),
      lockedByBusinessEvent: true,
      createdAt: request.deliveredAt,
    }] : []),
    ...(request.manualDeliveryEvidence ? [{
      id: `manual-delivery:${request.id}`,
      type: "DELIVERY_POD" as const,
      externalReference: request.manualDeliveryEvidence.evidenceRef,
      capturedAt: request.manualDeliveryEvidence.deliveredAt,
      capturedBy: request.manualDeliveryEvidence.actorName || request.manualDeliveryEvidence.actorId,
      verificationState: "UNVERIFIED" as const,
      notes: request.manualDeliveryEvidence.reason,
      lockedByBusinessEvent: true,
      createdAt: request.manualDeliveryEvidence.createdAt,
    }] : []),
    ...request.items.flatMap((item) => (item.evidenceRefs ?? []).map((reference, index) => ({
      id: `inspection:${item.orderLineId}:${index}`,
      type: "RETURN_INSPECTION" as const,
      externalReference: reference,
      capturedAt: request.inspection?.inspectedAt ?? request.updatedAt,
      capturedBy: request.inspection?.inspectedBy ?? request.ownerId,
      verificationState: request.inspection ? "VERIFIED" as const : "UNVERIFIED" as const,
      notes: `${item.productNameSnapshot} · ${item.inspectionNote ?? text("Bằng chứng kiểm tra", "Inspection evidence")}`,
      lockedByBusinessEvent: Boolean(request.inspection),
      createdAt: request.inspection?.inspectedAt ?? request.updatedAt,
    }))),
    ...intents.flatMap((intent) => (intent.externalReferences ?? (intent.externalReference ? [intent.externalReference] : [])).map((reference, index) => ({
      id: `resolution:${intent.id}:${index}`,
      type: intent.action === "REFUND" ? "REFUND" as const : intent.action === "REPLACEMENT_OUTBOUND" ? "REPLACEMENT_DELIVERY" as const : "OTHER" as const,
      externalReference: reference,
      capturedAt: intent.completedAt ?? intent.createdAt,
      capturedBy: intent.target,
      verificationState: intent.status === "SUCCEEDED" ? "VERIFIED" as const : "UNVERIFIED" as const,
      notes: `${intent.action} · ${intent.status}`,
      lockedByBusinessEvent: intent.status === "SUCCEEDED",
      createdAt: intent.createdAt,
    }))),
  ];
}

export function buildReturnOperationalModel(request: ReturnRequest, intents: ReturnResolutionIntent[]) {
  const approvedTotal = request.items.reduce((sum, item) => sum + (item.approvedQuantity ?? item.requestedQuantity), 0);
  const receivedTotal = request.items.reduce((sum, item) => sum + (item.receivedQuantity ?? 0), 0);
  const acceptedTotal = request.items.reduce((sum, item) => sum + (item.acceptedQuantity ?? 0), 0);
  const operationalStage = request.status === "APPROVED" && !request.returnMethod
    ? "Chưa chọn cách thu hồi hàng"
    : request.status === "AWAITING_ITEM" && receivedTotal > 0 && receivedTotal < approvedTotal
      ? "Đã nhận một phần"
      : request.status === "RECEIVED" && !request.inspection
        ? "Chờ kiểm tra"
        : request.status === "RECEIVED" ? "Chờ xử lý" : request.status;
  const blockers = [
    ...(!request.eligibilityResult.eligible && request.status === "REQUESTED" ? ["Yêu cầu không đủ eligibility; cần quyết định từ chối hoặc duyệt ngoại lệ có lý do."] : []),
    ...(request.status === "APPROVED" && !request.returnMethod ? ["Chưa chọn cách thu hồi hàng hoặc NO_PHYSICAL_RETURN."] : []),
    ...(request.status === "AWAITING_ITEM" && receivedTotal < approvedTotal ? [`Đã nhận ${receivedTotal}/${approvedTotal} đơn vị; chưa đủ để chuyển sang RECEIVED.`] : []),
    ...(request.status === "RECEIVED" && !request.inspection ? ["Đã nhận hàng nhưng chưa hoàn tất inspection accepted/rejected quantity."] : []),
    ...intents.filter((item) => item.status === "PENDING").map((item) => `Đang chờ ${item.target} evidence cho ${item.action}.`),
  ];
  const lifecycleDone = [
    true,
    request.status !== "REQUESTED",
    Boolean(request.returnMethod) || ["RECEIVED", "RESOLVED", "CLOSED"].includes(request.status),
    ["RECEIVED", "RESOLVED", "CLOSED"].includes(request.status),
    Boolean(request.inspection) || ["RESOLVED", "CLOSED"].includes(request.status),
    ["RESOLVED", "CLOSED"].includes(request.status),
  ].filter(Boolean).length;
  const lifecycle = [
    { key: "request", label: "Yêu cầu được tạo", description: request.code, state: "done" as const },
    { key: "approval", label: "Điều kiện & quyết định", description: request.decision?.outcome ?? "Chưa quyết định", state: request.status === "REQUESTED" ? "current" as const : request.status === "REJECTED" ? "blocked" as const : "done" as const },
    { key: "method", label: "Cách thu hồi hàng", description: request.returnMethod ? methodLabel[request.returnMethod.method] : "Chưa thiết lập", state: request.returnMethod || ["RECEIVED", "RESOLVED", "CLOSED"].includes(request.status) ? "done" as const : request.status === "APPROVED" ? "current" as const : "next" as const },
    { key: "receive", label: "Nhận hàng thực tế", description: `${receivedTotal}/${approvedTotal} đơn vị`, state: ["RECEIVED", "RESOLVED", "CLOSED"].includes(request.status) ? "done" as const : request.status === "AWAITING_ITEM" ? "current" as const : "next" as const },
    { key: "inspection", label: "Inspection", description: request.inspection ? `${acceptedTotal} accepted` : "Chưa hoàn tất", state: request.inspection || ["RESOLVED", "CLOSED"].includes(request.status) ? "done" as const : request.status === "RECEIVED" ? "current" as const : "next" as const },
    { key: "resolution", label: "Bằng chứng xử lý", description: `${intents.filter((item) => item.status === "SUCCEEDED").length}/${intents.length} intent thành công`, state: ["RESOLVED", "CLOSED"].includes(request.status) ? "done" as const : request.status === "RECEIVED" && request.inspection ? "current" as const : "next" as const },
  ];
  return { approvedTotal, receivedTotal, acceptedTotal, operationalStage, blockers, operationalScore: Math.round((lifecycleDone / 6) * 100), lifecycle };
}

export function buildReturnNextAction(input: {
  request: ReturnRequest;
  activeTab: string;
  openOverview: () => void;
  openReturnFlow: () => void;
  openResolution: () => void;
  openActivity: () => void;
  closeReturn: () => void;
}) {
  const { request } = input;
  if (request.status === "REQUESTED") return { title: "Bước vận hành tiếp theo", label: "Đánh giá & ra quyết định", description: "Kiểm tra điều kiện, số lượng được duyệt và lý do ngoại lệ nếu có.", actionLabel: "Mở tổng quan", variant: "info" as const, onClick: input.openOverview };
  if (request.status === "APPROVED") return { title: "Bước vận hành tiếp theo", label: "Thiết lập cách thu hồi", description: "Chọn đơn vị lấy hàng, khách tự gửi, điểm nhận hoặc không cần hoàn hàng.", actionLabel: "Mở luồng thu hồi", variant: "primary" as const, onClick: input.openReturnFlow };
  if (request.status === "AWAITING_ITEM") return { title: "Bước vận hành tiếp theo", label: "Ghi nhận hàng thực nhận", description: "Nhập số lượng thực tế từng dòng, không tự mặc định nhận đủ.", actionLabel: "Ghi nhận nhận hàng", variant: "primary" as const, onClick: input.openReturnFlow };
  if (request.status === "RECEIVED" && !request.inspection) return { title: "Bước vận hành tiếp theo", label: "Hoàn tất kiểm tra hàng", description: "Chốt số lượng chấp nhận, từ chối và bằng chứng tình trạng hàng.", actionLabel: "Mở inspection", variant: "warning" as const, onClick: input.openReturnFlow };
  if (request.status === "RECEIVED") return { title: "Bước vận hành tiếp theo", label: "Thực hiện phương án xử lý", description: "Hoàn tiền, gửi hàng thay thế, đổi hàng hoặc sửa chữa phải chờ đủ bằng chứng liên quan.", actionLabel: "Mở resolution", variant: "primary" as const, onClick: input.openResolution };
  if (request.status === "RESOLVED") return { title: "Bước vận hành tiếp theo", label: "Đóng Return", description: "Kiểm tra bằng chứng cuối cùng rồi chuyển hồ sơ sang ĐÃ ĐÓNG.", actionLabel: "Đóng hồ sơ", variant: "success" as const, onClick: input.closeReturn };
  if (input.activeTab === "ACTIVITY") return undefined;
  return { title: "Bước vận hành tiếp theo", label: "Xem hoạt động", description: "Hồ sơ hiện không có hành động vận hành bắt buộc.", actionLabel: "Mở hoạt động", variant: "info" as const, onClick: input.openActivity };
}
