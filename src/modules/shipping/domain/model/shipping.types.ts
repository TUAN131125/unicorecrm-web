import type { MoneyDto } from "@/shared/money";

export type ShippingPurpose = "ORDER_OUTBOUND" | "RETURN_PICKUP" | "REPLACEMENT_OUTBOUND" | "RETURN_TO_CUSTOMER";
export type ShippingSourceType = "ORDER" | "RETURN";
export type BookingStatus = "PENDING" | "BOOKED" | "FAILED" | "CANCELLED";
export type ExternalShippingStatus = "UNKNOWN" | "ACCEPTED" | "WAITING_PICKUP" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "DELIVERY_FAILED" | "RETURNED" | "CANCELLED";
export type ShippingFeePayer = "SENDER" | "RECIPIENT";
export type ShippingInspectionPolicy = "ALLOW_TRY" | "VIEW_ONLY" | "NO_OPEN";
export type ShippingPackageType = "BOX" | "ENVELOPE" | "PALLET" | "TUBE" | "OTHER";
export type ShippingTransportMode = "DOMESTIC" | "INTERNATIONAL" | "INSTANT";
export type ShippingGoodsType = "PARCEL" | "DOCUMENT";
export type ShippingPickupMethod = "ADDRESS" | "SMART_BOX" | "POST_OFFICE";
export type ShippingDeliveryMethod = "ADDRESS" | "SMART_BOX" | "POST_OFFICE";
export interface ShippingHandlingFlags {
  fragile?: boolean;
  liquid?: boolean;
  perishable?: boolean;
  hazardousGoods?: boolean;
  containsBattery?: boolean;
  keepUpright?: boolean;
  allowStacking?: boolean;
  highValue?: boolean;
  oversized?: boolean;
  solid?: boolean;
  powder?: boolean;
}

export type Money = MoneyDto;
export interface AddressSnapshot {
  line1: string;
  line2?: string;
  ward?: string;
  wardCode?: string;
  district?: string;
  districtCode?: string;
  city: string;
  provinceCode?: string;
  country?: string;
  countryCode?: string;
  postalCode?: string;
}
export interface RecipientSnapshot { name: string; phone: string; email?: string; address: AddressSnapshot; }
export interface ShippingLineAllocation { orderLineId?: string; productId: string; skuSnapshot?: string; productNameSnapshot: string; quantity: number; weightGrams?: number; declaredValue?: Money; hsCode?: string; countryOfOrigin?: string; }
export interface ShippingPackageUnit { id: string; packageNo: number; weightGrams: number; lengthCm?: number; widthCm?: number; heightCm?: number; lineAllocations?: ShippingLineAllocation[]; }
export interface ShippingCustomsSnapshot {
  contentsDescription?: string;
  invoiceNumber?: string;
  customsValue?: Money;
  documentNames?: string[];
  taxIdentificationNumber?: string;
}

export interface ShippingPackageSnapshot {
  packageCount: number;
  totalWeightGrams: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  packages?: ShippingPackageUnit[];
  lineAllocations?: ShippingLineAllocation[];
  declaredValue?: Money;
  feePayer?: ShippingFeePayer;
  inspectionPolicy?: ShippingInspectionPolicy;
  pickupShift?: string;
  deliveryNote?: string;
  itemSummary?: string;
  note?: string;
  packageType?: ShippingPackageType;
  handling?: ShippingHandlingFlags;
  insuranceRequested?: boolean;
  pickupNote?: string;
  transportMode?: ShippingTransportMode;
  goodsType?: ShippingGoodsType;
  pickupMethod?: ShippingPickupMethod;
  deliveryMethod?: ShippingDeliveryMethod;
  pickupWindow?: string;
  deliveryWindow?: string;
  promotionCode?: string;
  volumetricWeightGrams?: number;
  customs?: ShippingCustomsSnapshot;
}

export interface ShippingBookingReadiness {
  ready: boolean;
  score: number;
  missingRequired: string[];
  warnings: string[];
  checkedAt: string;
}

export interface ShippingBooking {
  id: string;
  workspaceId?: string;
  code: string;
  sourceType: ShippingSourceType;
  sourceId: string;
  purpose: ShippingPurpose;
  transportMode?: ShippingTransportMode;
  providerId: string;
  providerNameSnapshot: string;
  serviceCode?: string;
  serviceNameSnapshot?: string;
  bookingStatus: BookingStatus;
  externalStatus: ExternalShippingStatus;
  externalBookingId?: string;
  trackingCode?: string;
  externalUrl?: string;
  pickupLocationSnapshot: AddressSnapshot & { id?: string; name?: string; contactName?: string; phone?: string };
  returnLocationSnapshot?: AddressSnapshot & { id?: string; name?: string; contactName?: string; phone?: string };
  recipientSnapshot: RecipientSnapshot;
  packageSnapshot: ShippingPackageSnapshot;
  shippingFee?: Money;
  codAmount?: Money;
  codCollectedAmount?: Money;
  codCollectedAt?: string;
  deliveredAt?: string;
  providerUpdatedAt?: string;
  lastSyncedAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  bookedAt?: string;
  bookedBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  /** Demo/local command metadata; absent from authoritative production reads. */
  idempotencyKey?: string;
  shipmentGroupId: string;
  attemptNo?: number;
  readiness?: ShippingBookingReadiness;
  correlationId?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  resourceVersion?: number;
}

export interface ShippingQuote { providerId: string; providerName: string; serviceCode: string; serviceName: string; fee: Money; estimatedDays?: number; estimatedDeliveryAt?: string; }
export interface CreateShippingBookingResult { externalBookingId: string; trackingCode?: string; externalUrl?: string; externalStatus: ExternalShippingStatus; shippingFee?: Money; providerUpdatedAt?: string; }
export interface ExternalShippingSnapshot { externalStatus: ExternalShippingStatus; deliveredAt?: string; providerUpdatedAt?: string; trackingCode?: string; externalUrl?: string; codCollectedAmount?: Money; codCollectedAt?: string; }

export interface PickupLocation { id: string; name: string; contactName: string; phone: string; address: AddressSnapshot; isDefault: boolean; isActive: boolean; }
export interface ShippingProviderConfiguration { id: string; providerId: string; providerName: string; adapterType: "MANUAL" | "GRAB" | "GHN" | "GHTK" | "VIETTEL_POST"; state: "CONNECTED" | "PAUSED" | "ERROR"; isDefault: boolean; credentialReference?: string; updatedAt: string; }
