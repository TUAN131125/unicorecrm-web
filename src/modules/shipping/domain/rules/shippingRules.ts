import type { ShippingBooking, ShippingBookingReadiness } from "../model/shipping.types";
import type { ShippingBookingRequirements } from "../model/shippingProvider";
import { validateEmail, validatePhone } from "@/shared/lib/contactDataValidation";
import { isPositiveMoney } from "@/shared/money";

export function evaluateShippingBookingReadiness(
  input: Pick<ShippingBooking, "sourceType" | "sourceId" | "purpose" | "pickupLocationSnapshot" | "recipientSnapshot" | "packageSnapshot" | "providerId" | "serviceCode" | "returnLocationSnapshot">,
  requirements: ShippingBookingRequirements = {},
  now = new Date().toISOString(),
): ShippingBookingReadiness {
  const missingRequired: string[] = [];
  const warnings: string[] = [];
  const require = (condition: unknown, label: string) => { if (!condition) missingRequired.push(label); };
  const warn = (condition: unknown, label: string) => { if (!condition) warnings.push(label); };

  require(input.sourceId.trim(), "Nguồn nghiệp vụ");
  require(input.providerId.trim(), "Đơn vị vận chuyển");
  require(input.recipientSnapshot.name.trim(), "Tên người nhận");
  require(input.recipientSnapshot.phone.trim(), "Số điện thoại người nhận");
  if (input.recipientSnapshot.phone.trim() && !validatePhone(input.recipientSnapshot.phone).valid) missingRequired.push("Số điện thoại người nhận hợp lệ");
  if (input.recipientSnapshot.email?.trim() && !validateEmail(input.recipientSnapshot.email).valid) missingRequired.push("Email người nhận hợp lệ");
  require(input.recipientSnapshot.address.line1.trim(), "Địa chỉ giao hàng");
  require(input.recipientSnapshot.address.city.trim(), "Tỉnh/Thành phố giao hàng");
  require(input.pickupLocationSnapshot?.line1.trim(), "Địa chỉ lấy hàng");
  require(input.pickupLocationSnapshot?.city.trim(), "Tỉnh/Thành phố lấy hàng");
  require(input.packageSnapshot.packageCount > 0, "Số kiện");
  require(input.packageSnapshot.totalWeightGrams > 0, "Trọng lượng");

  const transportMode = input.packageSnapshot.transportMode ?? "DOMESTIC";
  const goodsType = input.packageSnapshot.goodsType;
  if (transportMode === "INTERNATIONAL") {
    require(goodsType, "Loại hàng hóa quốc tế");
    require(input.recipientSnapshot.address.countryCode?.trim(), "Mã quốc gia người nhận");
    require(input.recipientSnapshot.address.postalCode?.trim(), "Mã bưu chính người nhận");
    if (goodsType === "PARCEL") {
      require(input.packageSnapshot.customs?.contentsDescription?.trim(), "Mô tả khai báo hải quan");
      require(input.packageSnapshot.declaredValue && isPositiveMoney(input.packageSnapshot.declaredValue), "Trị giá khai báo quốc tế");
      warn(input.packageSnapshot.lineAllocations?.every((line) => line.hsCode?.trim()), "Nên bổ sung HS code cho từng dòng hàng quốc tế");
      warn(input.packageSnapshot.customs?.documentNames?.length, "Nên đính kèm hóa đơn hoặc chứng từ quốc tế");
    }
  }
  if (transportMode === "INSTANT") {
    require(input.packageSnapshot.pickupWindow?.trim(), "Thời gian lấy hàng giao ngay");
    require(input.packageSnapshot.deliveryWindow?.trim(), "Thời gian giao dự kiến");
    warn(input.pickupLocationSnapshot?.city.trim() === input.recipientSnapshot.address.city.trim(), "Giao ngay nên giới hạn trong cùng tỉnh/thành phố");
  }
  if (goodsType === "PARCEL") {
    require(input.packageSnapshot.lineAllocations?.length || input.packageSnapshot.packages?.some((pkg) => pkg.lineAllocations?.length), "Danh sách hàng hóa");
  }

  if (requirements.serviceCode) require(input.serviceCode?.trim(), "Dịch vụ vận chuyển");
  if (requirements.administrativeCodes) {
    require(input.recipientSnapshot.address.districtCode?.trim(), "Mã Quận/Huyện người nhận");
    require(input.recipientSnapshot.address.wardCode?.trim(), "Mã Phường/Xã người nhận");
  } else {
    warn(input.recipientSnapshot.address.district || input.recipientSnapshot.address.districtCode, "Nên bổ sung Quận/Huyện");
    warn(input.recipientSnapshot.address.ward || input.recipientSnapshot.address.wardCode, "Nên bổ sung Phường/Xã");
  }
  if (requirements.dimensions) require(input.packageSnapshot.lengthCm && input.packageSnapshot.widthCm && input.packageSnapshot.heightCm, "Kích thước kiện hàng");
  else warn(input.packageSnapshot.lengthCm && input.packageSnapshot.widthCm && input.packageSnapshot.heightCm, "Nên bổ sung kích thước kiện hàng");
  if (requirements.lineAllocations) require(input.packageSnapshot.lineAllocations?.length || input.packageSnapshot.packages?.some((pkg) => pkg.lineAllocations?.length), "Phân bổ dòng hàng vào kiện");
  else warn(input.packageSnapshot.lineAllocations?.length || input.packageSnapshot.packages?.some((pkg) => pkg.lineAllocations?.length), "Nên bổ sung danh sách hàng hóa có cấu trúc");
  if (requirements.declaredValue) require(input.packageSnapshot.declaredValue && isPositiveMoney(input.packageSnapshot.declaredValue), "Giá trị khai báo");
  else warn(input.packageSnapshot.declaredValue && isPositiveMoney(input.packageSnapshot.declaredValue), "Nên bổ sung giá trị khai báo/bảo hiểm");
  if (requirements.feePayer) require(input.packageSnapshot.feePayer, "Người trả phí vận chuyển");
  else warn(input.packageSnapshot.feePayer, "Nên xác định người trả phí vận chuyển");
  if (requirements.inspectionPolicy) require(input.packageSnapshot.inspectionPolicy, "Chính sách xem/thử hàng");
  else warn(input.packageSnapshot.inspectionPolicy, "Nên xác định chính sách xem/thử hàng");
  if (input.purpose === "ORDER_OUTBOUND") warn(input.returnLocationSnapshot, "Nên xác định địa chỉ hoàn hàng khi giao thất bại");
  if (input.packageSnapshot.handling?.fragile) warn(input.packageSnapshot.deliveryNote, "Hàng dễ vỡ nên có hướng dẫn đóng gói/giao nhận");
  if (input.packageSnapshot.handling?.hazardousGoods) warn(false, "Hàng nguy hiểm cần xác nhận provider hỗ trợ và chuẩn bị chứng từ phù hợp");
  if (input.packageSnapshot.handling?.containsBattery) warn(false, "Kiện có pin cần kiểm tra giới hạn vận chuyển của provider");
  if (input.packageSnapshot.handling?.liquid) warn(input.packageSnapshot.deliveryNote || input.packageSnapshot.pickupNote, "Hàng chất lỏng nên có hướng dẫn đóng gói và xử lý");
  if (input.packageSnapshot.handling?.oversized) warn(input.packageSnapshot.lengthCm && input.packageSnapshot.widthCm && input.packageSnapshot.heightCm, "Hàng quá khổ cần kích thước kiện đầy đủ");
  if (input.packageSnapshot.volumetricWeightGrams && input.packageSnapshot.volumetricWeightGrams > input.packageSnapshot.totalWeightGrams) warn(false, "Provider có thể tính cước theo khối lượng quy đổi");
  if (input.packageSnapshot.declaredValue && isPositiveMoney(input.packageSnapshot.declaredValue)) warn(input.packageSnapshot.insuranceRequested, "Nên cân nhắc bảo hiểm cho kiện có khai giá");

  const totalChecks = 10 + Object.values(requirements).filter(Boolean).length + warnings.length;
  const score = Math.max(0, Math.min(100, Math.round(((totalChecks - missingRequired.length - warnings.length * 0.35) / Math.max(1, totalChecks)) * 100)));
  return { ready: missingRequired.length === 0, score, missingRequired, warnings, checkedAt: now };
}

export function assertShippingBookingInput(input: Pick<ShippingBooking, "sourceType" | "sourceId" | "purpose" | "pickupLocationSnapshot" | "recipientSnapshot" | "packageSnapshot" | "providerId" | "serviceCode" | "returnLocationSnapshot">, requirements: ShippingBookingRequirements = {}): void {
  if (input.sourceType === "ORDER" && input.purpose !== "ORDER_OUTBOUND") throw new Error("Order source only supports ORDER_OUTBOUND shipping purpose.");
  if (input.sourceType === "RETURN" && input.purpose === "ORDER_OUTBOUND") throw new Error("Return source cannot use ORDER_OUTBOUND purpose.");
  const readiness = evaluateShippingBookingReadiness(input, requirements);
  if (!readiness.ready) throw new Error(`Shipping booking chưa đủ dữ liệu: ${readiness.missingRequired.join(", ")}.`);
}

export function isShippingWorkQueueItem(booking: ShippingBooking): boolean {
  return booking.bookingStatus === "FAILED" || booking.externalStatus === "DELIVERY_FAILED" || Boolean(booking.lastErrorCode || booking.lastErrorMessage) || booking.readiness?.ready === false;
}

export function isDeliveredShippingEvidence(booking: ShippingBooking): boolean {
  return booking.externalStatus === "DELIVERED" && Boolean(booking.deliveredAt);
}

export function isTerminalShippingFailureEvidence(booking: ShippingBooking): boolean {
  return booking.externalStatus === "RETURNED" || booking.externalStatus === "CANCELLED" || booking.bookingStatus === "CANCELLED";
}

export function getShippingRequirementGroup(booking: ShippingBooking): string {
  return booking.shipmentGroupId?.trim() || booking.id;
}
