import type { ShippingBookingReadModel, ShippingLocationReadModel } from "@/platform/api/generated/commercialApi";
import type { AddressSnapshot, ShippingBooking } from "../../domain/model/shipping.types";

export function mapShippingBookingReadModelToApplication(dto: ShippingBookingReadModel): ShippingBooking {
  return {
    id: dto.id,
    code: dto.code,
    sourceType: dto.sourceType,
    sourceId: dto.sourceId,
    purpose: dto.purpose,
    transportMode: dto.transportMode,
    providerId: dto.providerId,
    providerNameSnapshot: dto.providerName,
    serviceCode: dto.serviceCode,
    serviceNameSnapshot: dto.serviceName,
    bookingStatus: dto.bookingStatus,
    externalStatus: dto.externalStatus,
    externalBookingId: dto.externalBookingId,
    trackingCode: dto.trackingCode,
    externalUrl: dto.externalUrl,
    pickupLocationSnapshot: mapLocation(dto.pickupLocation),
    returnLocationSnapshot: dto.returnLocation === undefined ? undefined : mapLocation(dto.returnLocation),
    recipientSnapshot: {
      name: dto.recipient.name,
      phone: dto.recipient.phone,
      email: dto.recipient.email,
      address: {
        line1: dto.recipient.address.line1,
        line2: dto.recipient.address.line2,
        ward: dto.recipient.address.ward,
        district: dto.recipient.address.district,
        city: dto.recipient.address.city,
        countryCode: dto.recipient.address.countryCode,
        postalCode: dto.recipient.address.postalCode,
      },
    },
    packageSnapshot: {
      packageCount: dto.packageSummary.packageCount,
      totalWeightGrams: dto.packageSummary.totalWeightGrams,
      declaredValue: dto.packageSummary.declaredValue,
      itemSummary: dto.packageSummary.itemSummary,
      lengthCm: dto.packageSummary.lengthCm,
      widthCm: dto.packageSummary.widthCm,
      heightCm: dto.packageSummary.heightCm,
      feePayer: dto.packageSummary.feePayer,
      inspectionPolicy: dto.packageSummary.inspectionPolicy,
      note: dto.packageSummary.note,
      pickupNote: dto.packageSummary.pickupNote,
      deliveryNote: dto.packageSummary.deliveryNote,
      transportMode: dto.packageSummary.transportMode,
      goodsType: dto.packageSummary.goodsType,
      lineAllocations: dto.packageSummary.lineAllocations?.map((line) => ({
        orderLineId: line.orderLineId,
        productId: line.productId,
        skuSnapshot: line.sku,
        productNameSnapshot: line.productName,
        quantity: line.quantity,
        weightGrams: line.weightGrams,
        declaredValue: line.declaredValue,
        hsCode: line.hsCode,
        countryOfOrigin: line.countryOfOrigin,
      })),
    },
    shippingFee: dto.shippingFee,
    codAmount: dto.codAmount,
    codCollectedAmount: dto.codCollectedAmount,
    codCollectedAt: dto.codCollectedAt,
    deliveredAt: dto.deliveredAt,
    providerUpdatedAt: dto.providerUpdatedAt,
    lastSyncedAt: dto.lastSyncedAt,
    lastErrorCode: dto.lastErrorCode,
    lastErrorMessage: dto.lastErrorMessage,
    bookedAt: dto.bookedAt,
    bookedBy: dto.bookedBy,
    cancelledAt: dto.cancelledAt,
    cancellationReason: dto.cancellationReason,
    shipmentGroupId: dto.shipmentGroupId,
    attemptNo: dto.attemptNo,
    readiness: mapReadiness(dto.readiness),
    correlationId: dto.correlationId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    version: dto.resourceVersion,
    resourceVersion: dto.resourceVersion,
  };
}

function mapReadiness(value: Record<string, unknown> | undefined): ShippingBooking["readiness"] {
  if (!value) return undefined;
  if (
    typeof value.ready !== "boolean"
    || typeof value.score !== "number"
    || !Array.isArray(value.missingRequired)
    || !Array.isArray(value.warnings)
    || typeof value.checkedAt !== "string"
  ) return undefined;
  return {
    ready: value.ready,
    score: value.score,
    missingRequired: value.missingRequired.filter((item): item is string => typeof item === "string"),
    warnings: value.warnings.filter((item): item is string => typeof item === "string"),
    checkedAt: value.checkedAt,
  };
}

function mapLocation(value: ShippingLocationReadModel): AddressSnapshot & { id?: string; name?: string; contactName?: string; phone?: string } {
  return {
    id: value.id,
    name: value.name,
    contactName: value.contactName,
    phone: value.phone,
    line1: value.line1,
    line2: value.line2,
    ward: value.ward,
    district: value.district,
    city: value.city,
    countryCode: value.countryCode,
    postalCode: value.postalCode,
  };
}
