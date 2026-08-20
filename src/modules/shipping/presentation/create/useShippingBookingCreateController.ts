import { formatApplicationError } from "@/shared/operations";
import { createCreateCommandTarget, createProvisionalDocumentNumber } from "@/shared/ids";
import React from "react";
import { getCodCollectibleAmountForOrderSnapshot } from "@/modules/payments";
import { getOrderFulfillmentFieldErrors, resolveOrderLineFulfillmentKind, type CustomerOrder } from "@/modules/orders";
import { validateEmail, validatePhone } from "@/platform/contact-data";
import type { Contact } from "@/modules/contacts";
import type { CustomerDisplay } from "@/modules/customers";
import type { Product } from "@/modules/products";
import type { RecipientSnapshot, ShippingBooking, ShippingGoodsType, ShippingHandlingFlags, ShippingLineAllocation, ShippingPackageSnapshot, ShippingTransportMode } from "../../domain/model/shipping.types";
import type { PickupLocationConfiguration } from "../../domain/model/shippingConfiguration.types";
import type { ShippingProvider } from "../../domain/model/shippingProvider";
import { evaluateShippingBookingReadiness } from "../../domain/rules/shippingRules";
import type { CreateOrderOutboundShippingBookingInput } from "@/workflows/order-shipping-booking";

export interface ShippingBookingCreatePageProps {
  onCancel(): void;
  initialOrderId?: string;
  initialOrderIssue?: "ORDER_NOT_FOUND" | "ORDER_NOT_CONFIRMED" | "NO_PHYSICAL_LINES";
  confirmedOrders: CustomerOrder[];
  pickupLocations: PickupLocationConfiguration[];
  providers: ShippingProvider[];
  existingBookingCount: number;
  actorId: string;
  actorName: string;
  onOpenOrder(orderId: string): void;
  onCreate(input: CreateOrderOutboundShippingBookingInput): Promise<ShippingBooking>;
  onCreated(booking: ShippingBooking, message: string): void;
  contacts?: Contact[];
  customers?: CustomerDisplay[];
  products?: Product[];
  locale: "vi" | "en";
}

import {
  makeGoodsFromOrder,
  serviceOptions,
  type GoodsDraft,
} from "../create/shippingBookingCreateModel";

export function useShippingBookingCreateController(props: ShippingBookingCreatePageProps) {
  const {
  onCancel,
  initialOrderId,
  initialOrderIssue,
  confirmedOrders,
  pickupLocations,
  providers,
  existingBookingCount,
  actorId,
  actorName,
  onOpenOrder,
  onCreate,
  onCreated,
  locale,
  contacts = [],
  customers = [],
  products = [],
} = props;
  const text = React.useCallback((vi: string, en: string) => locale === "vi" ? vi : en, [locale]);
  const defaultPickup = React.useMemo(() => pickupLocations.find((item) => item.isDefault) ?? pickupLocations[0], [pickupLocations]);
  const defaultProvider = React.useMemo(() => providers.find((provider) => provider.isDefault) ?? providers[0], [providers]);

  const [mode, setMode] = React.useState<ShippingTransportMode>("DOMESTIC");
  const [orderId, setOrderId] = React.useState("");
  const [pickupLocationId, setPickupLocationId] = React.useState("");
  const [providerId, setProviderId] = React.useState("");
  const [serviceCode, setServiceCode] = React.useState("standard");
  const [pickupMethod, setPickupMethod] = React.useState<"ADDRESS" | "SMART_BOX" | "POST_OFFICE">("ADDRESS");
  const [deliveryMethod, setDeliveryMethod] = React.useState<"ADDRESS" | "SMART_BOX" | "POST_OFFICE">("ADDRESS");
  const [pickupWindow, setPickupWindow] = React.useState("");
  const [deliveryWindow, setDeliveryWindow] = React.useState("");
  const [promotionCode, setPromotionCode] = React.useState("");

  const [recipientName, setRecipientName] = React.useState("");
  const [recipientPhone, setRecipientPhone] = React.useState("");
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [recipientLine1, setRecipientLine1] = React.useState("");
  const [recipientLine2, setRecipientLine2] = React.useState("");
  const [recipientCity, setRecipientCity] = React.useState("");
  const [recipientDistrict, setRecipientDistrict] = React.useState("");
  const [recipientWard, setRecipientWard] = React.useState("");
  const [recipientCountryCode, setRecipientCountryCode] = React.useState("VN");
  const [recipientPostalCode, setRecipientPostalCode] = React.useState("");
  const [recipientOverrideReason, setRecipientOverrideReason] = React.useState("");

  const [goodsType, setGoodsType] = React.useState<ShippingGoodsType>("PARCEL");
  const [goods, setGoods] = React.useState<GoodsDraft[]>([]);
  const [packageCount, setPackageCount] = React.useState(1);
  const [packageType, setPackageType] = React.useState<"BOX" | "ENVELOPE" | "PALLET" | "TUBE" | "OTHER">("BOX");
  const [totalWeightGrams, setTotalWeightGrams] = React.useState(0);
  const [lengthCm, setLengthCm] = React.useState(20);
  const [widthCm, setWidthCm] = React.useState(15);
  const [heightCm, setHeightCm] = React.useState(10);
  const [declaredValue, setDeclaredValue] = React.useState(0);
  const [insuranceRequested, setInsuranceRequested] = React.useState(false);
  const [handling, setHandling] = React.useState<ShippingHandlingFlags>({ allowStacking: true });

  const [feePayer, setFeePayer] = React.useState<"SENDER" | "RECIPIENT">("SENDER");
  const [inspectionPolicy, setInspectionPolicy] = React.useState<"ALLOW_TRY" | "VIEW_ONLY" | "NO_OPEN">("VIEW_ONLY");
  const [pickupNote, setPickupNote] = React.useState("");
  const [deliveryNote, setDeliveryNote] = React.useState("");

  const [customsDescription, setCustomsDescription] = React.useState("");
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [taxIdentificationNumber, setTaxIdentificationNumber] = React.useState("");
  const [documentNames, setDocumentNames] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState("");
  const [hasSubmitAttempted, setHasSubmitAttempted] = React.useState(false);

  const selectedOrder = React.useMemo(
    () => confirmedOrders.find((order) => order.id === orderId),
    [confirmedOrders, orderId],
  );
  const selectedPickup = pickupLocations.find((item) => item.id === pickupLocationId) ?? defaultPickup;
  const selectedProvider = providers.find((provider) => provider.id === providerId) ?? defaultProvider;
  const configuredServices = React.useMemo(() => (selectedProvider?.services ?? [])
    .filter((service) => service.enabled && service.supportedModes.includes(mode)), [mode, selectedProvider]);
  const selectedService = configuredServices.find((service) => service.code === serviceCode);
  const codAmount = selectedOrder ? getCodCollectibleAmountForOrderSnapshot(selectedOrder.id) : 0;

  const resetFromOrder = React.useCallback((order?: CustomerOrder) => {
    const mappedGoods = makeGoodsFromOrder(order, products);
    const mappedWeight = mappedGoods.reduce((sum, item) => sum + Math.max(0, item.weightGrams) * Math.max(1, item.quantity), 0);

    setRecipientName(order?.recipientName || "");
    setRecipientPhone(order?.recipientPhone || "");
    setRecipientEmail(order?.recipientEmail || "");
    setRecipientLine1(order?.shippingAddress?.line1 || "");
    setRecipientLine2(order?.shippingAddress?.line2 ?? "");
    setRecipientCity(order?.shippingAddress?.city || "");
    setRecipientDistrict(order?.shippingAddress?.district ?? "");
    setRecipientWard(order?.shippingAddress?.ward ?? "");
    setRecipientCountryCode(order?.shippingAddress?.country === "Vietnam" || !order?.shippingAddress?.country ? "VN" : "");
    setRecipientPostalCode(order?.shippingAddress?.postalCode ?? "");
    setRecipientOverrideReason("");
    setGoods(mappedGoods.length > 0 ? mappedGoods : makeGoodsFromOrder(order, products));
    setTotalWeightGrams(mappedWeight);
    setDeclaredValue(order?.grandTotal ?? order?.totalAmount ?? 0);
  }, [products]);

  const initializedContextRef = React.useRef("");
  const hydratedOrderRef = React.useRef("");
  const initializationKey = React.useMemo(() => [
    initialOrderId ?? "",
    confirmedOrders.map((order) => `${order.id}:${order.updatedAt ?? order.createdAt ?? ""}`).join("|"),
    defaultPickup?.id ?? "",
    defaultProvider?.id ?? "",
  ].join("::"), [confirmedOrders, defaultPickup?.id, defaultProvider?.id, initialOrderId]);

  React.useEffect(() => {
    if (initializedContextRef.current === initializationKey) return;
    initializedContextRef.current = initializationKey;
    const preferredOrderId = initialOrderId
      ? (confirmedOrders.some((order) => order.id === initialOrderId) ? initialOrderId : "")
      : confirmedOrders[0]?.id ?? "";
    const preferredOrder = confirmedOrders.find((order) => order.id === preferredOrderId);
    setMode("DOMESTIC");
    setOrderId(preferredOrderId);
    setPickupLocationId(defaultPickup?.id ?? "");
    setProviderId(defaultProvider?.id ?? "");
    setServiceCode(defaultProvider?.services?.find((service) => service.enabled && service.supportedModes.includes("DOMESTIC"))?.code ?? "");
    setPickupMethod("ADDRESS");
    setDeliveryMethod("ADDRESS");
    setPickupWindow("");
    setDeliveryWindow("");
    setPromotionCode("");
    hydratedOrderRef.current = preferredOrder ? `${preferredOrder.id}:${preferredOrder.updatedAt ?? preferredOrder.createdAt ?? ""}` : "";
    resetFromOrder(preferredOrder);
    setGoodsType("PARCEL");
    setPackageCount(1);
    setPackageType("BOX");
    setLengthCm(20);
    setWidthCm(15);
    setHeightCm(10);
    setInsuranceRequested(false);
    setHandling({ allowStacking: true });
    setFeePayer("SENDER");
    setInspectionPolicy("VIEW_ONLY");
    setPickupNote("");
    setDeliveryNote("");
    setCustomsDescription("");
    setInvoiceNumber("");
    setTaxIdentificationNumber("");
    setDocumentNames([]);
    setSubmitError("");
    setHasSubmitAttempted(false);
  }, [confirmedOrders, defaultPickup, defaultProvider, initialOrderId, initializationKey, resetFromOrder]);

  React.useEffect(() => {
    if (!selectedOrder) return;
    const hydrationKey = `${selectedOrder.id}:${selectedOrder.updatedAt ?? selectedOrder.createdAt ?? ""}`;
    if (hydratedOrderRef.current === hydrationKey) return;
    hydratedOrderRef.current = hydrationKey;
    resetFromOrder(selectedOrder);
  }, [resetFromOrder, selectedOrder]);

  React.useEffect(() => {
    setServiceCode((current) => configuredServices.some((service) => service.code === current) ? current : configuredServices[0]?.code ?? "");
    if (mode === "INTERNATIONAL") {
      setRecipientCountryCode((current) => current === "VN" ? "" : current);
      setDeliveryMethod("ADDRESS");
    } else {
      setRecipientCountryCode("VN");
    }
    if (mode === "INSTANT") setPackageCount(1);
  }, [configuredServices, mode]);

  const goodsWeight = goods.reduce((sum, item) => sum + Math.max(0, item.weightGrams) * Math.max(1, item.quantity), 0);
  const actualWeight = totalWeightGrams > 0 ? totalWeightGrams : goodsWeight;
  const volumetricWeightGrams = Math.max(0, Math.round((lengthCm * widthCm * heightCm * Math.max(1, packageCount) / 5000) * 1000));
  const chargeableWeight = Math.max(actualWeight, volumetricWeightGrams);
  const goodsValue = goods.reduce((sum, item) => sum + Math.max(0, item.declaredValue), 0);
  const effectiveDeclaredValue = declaredValue > 0 ? declaredValue : goodsValue;

  const recipientSnapshot: RecipientSnapshot = {
    name: recipientName.trim(),
    phone: recipientPhone.trim(),
    email: recipientEmail.trim() || undefined,
    address: {
      line1: recipientLine1.trim(),
      line2: recipientLine2.trim() || undefined,
      ward: recipientWard.trim() || undefined,
      district: recipientDistrict.trim() || undefined,
      city: recipientCity.trim(),
      countryCode: recipientCountryCode.trim() || undefined,
      country: recipientCountryCode === "VN" ? "Vietnam" : undefined,
      postalCode: recipientPostalCode.trim() || undefined,
    },
  };

  const lineAllocations: ShippingLineAllocation[] = goods.map((item) => ({
    orderLineId: item.orderLineId,
    productId: item.productId || `custom_${item.id}`,
    skuSnapshot: item.sku || undefined,
    productNameSnapshot: item.name.trim(),
    quantity: Math.max(1, item.quantity),
    weightGrams: Math.max(0, item.weightGrams) || undefined,
    declaredValue: item.declaredValue > 0 ? { amount: String(item.declaredValue), currency: selectedOrder?.currency ?? "VND" } : undefined,
    hsCode: item.hsCode.trim() || undefined,
    countryOfOrigin: item.countryOfOrigin.trim() || undefined,
  }));

  const packageSnapshot: ShippingPackageSnapshot = {
    packageCount: Math.max(1, packageCount),
    totalWeightGrams: actualWeight,
    lengthCm: Math.max(1, lengthCm),
    widthCm: Math.max(1, widthCm),
    heightCm: Math.max(1, heightCm),
    volumetricWeightGrams,
    lineAllocations,
    declaredValue: effectiveDeclaredValue > 0 ? { amount: String(effectiveDeclaredValue), currency: selectedOrder?.currency ?? "VND" } : undefined,
    feePayer,
    inspectionPolicy,
    pickupNote: pickupNote.trim() || undefined,
    deliveryNote: deliveryNote.trim() || undefined,
    packageType,
    handling,
    insuranceRequested,
    transportMode: mode,
    goodsType,
    pickupMethod,
    deliveryMethod,
    pickupWindow: pickupWindow || undefined,
    deliveryWindow: deliveryWindow || undefined,
    promotionCode: promotionCode.trim() || undefined,
    itemSummary: goods.map((item) => `${item.name} × ${item.quantity}`).join(", "),
    customs: mode === "INTERNATIONAL" ? {
      contentsDescription: customsDescription.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      customsValue: effectiveDeclaredValue > 0 ? { amount: String(effectiveDeclaredValue), currency: selectedOrder?.currency ?? "VND" } : undefined,
      documentNames,
      taxIdentificationNumber: taxIdentificationNumber.trim() || undefined,
    } : undefined,
  };

  const baseReadiness = selectedOrder && selectedPickup ? evaluateShippingBookingReadiness({
    sourceType: "ORDER",
    sourceId: selectedOrder.id,
    purpose: "ORDER_OUTBOUND",
    providerId,
    serviceCode,
    pickupLocationSnapshot: {
      line1: selectedPickup.addressLine,
      city: selectedPickup.city,
      name: selectedPickup.name,
      id: selectedPickup.id,
      contactName: selectedPickup.contactName,
      phone: selectedPickup.phone,
    },
    returnLocationSnapshot: {
      line1: selectedPickup.addressLine,
      city: selectedPickup.city,
      name: selectedPickup.name,
      id: selectedPickup.id,
      contactName: selectedPickup.contactName,
      phone: selectedPickup.phone,
    },
    recipientSnapshot,
    packageSnapshot,
  }) : undefined;

  const canonicalOrderErrors = selectedOrder ? getOrderFulfillmentFieldErrors(selectedOrder) : {};
  const canonicalOrderMissing = Object.keys(canonicalOrderErrors);

  const extraMissing = [
    ...canonicalOrderMissing.map((field) => text(`Order: ${field}`, `Order: ${field}`)),
    ...(goods.length === 0 ? [text("Danh sách hàng hóa", "Goods list")] : []),
    ...(goods.some((item) => !item.name.trim() || item.quantity <= 0) ? [text("Tên và số lượng hàng hóa", "Goods names and quantities")] : []),
    ...(mode === "INTERNATIONAL" && !recipientCountryCode.trim() ? [text("Quốc gia nhận", "Destination country")] : []),
    ...(mode === "INTERNATIONAL" && !recipientPostalCode.trim() ? [text("Mã bưu chính quốc tế", "International postal code")] : []),
    ...(mode === "INTERNATIONAL" && goodsType === "PARCEL" && !customsDescription.trim() ? [text("Mô tả khai báo hải quan", "Customs description")] : []),
    ...(mode === "INSTANT" && !pickupWindow ? [text("Thời gian lấy hàng", "Pickup time")] : []),
    ...(mode === "INSTANT" && !deliveryWindow ? [text("Thời gian giao dự kiến", "Delivery time")] : []),
    ...(!selectedProvider ? [text("Đơn vị vận chuyển đang hoạt động", "Active carrier")] : []),
    ...(!selectedService ? [text("Dịch vụ được provider hỗ trợ", "Carrier-supported service")] : []),
    ...(codAmount > 0 && (!selectedProvider?.capabilities?.cod || !selectedService?.supportsCod) ? [text("Dịch vụ hỗ trợ COD", "COD-capable service")] : []),
  ];
  const recipientChangedFromOrder = Boolean(selectedOrder) && [
    recipientName.trim() !== (selectedOrder?.recipientName ?? "").trim(),
    recipientPhone.trim() !== (selectedOrder?.recipientPhone ?? "").trim(),
    recipientLine1.trim() !== (selectedOrder?.shippingAddress?.line1 ?? "").trim(),
    recipientCity.trim() !== (selectedOrder?.shippingAddress?.city ?? "").trim(),
  ].some(Boolean);
  if (recipientChangedFromOrder && !recipientOverrideReason.trim()) extraMissing.push(text("Lý do thay đổi người nhận so với Order", "Reason for recipient override"));

  const warnings = [
    ...(baseReadiness?.warnings ?? []),
    ...(chargeableWeight > actualWeight && actualWeight > 0 ? [text("Khối lượng quy đổi lớn hơn khối lượng thực; provider có thể tính cước theo khối lượng quy đổi.", "Volumetric weight exceeds actual weight; the carrier may charge by volumetric weight.")] : []),
    ...(handling.hazardousGoods ? [text("Hàng nguy hiểm cần xác nhận tuyến vận chuyển, quy cách đóng gói và chứng từ trước khi gửi.", "Dangerous goods require route, packaging and document verification before dispatch.")] : []),
    ...(handling.containsBattery ? [text("Kiện có pin/ắc quy có thể bị hạn chế theo tuyến và phương thức vận chuyển.", "Battery shipments may be restricted by route and transport method.")] : []),
    ...(recipientChangedFromOrder ? [text("Thông tin người nhận đã khác Order; booking sẽ lưu snapshot vận chuyển và không tự sửa Order.", "Recipient data differs from the Order; the booking stores an operational snapshot and does not update the Order automatically.")] : []),
  ];
  const missingRequired = [...(baseReadiness?.missingRequired ?? []), ...extraMissing];
  const ready = Boolean(baseReadiness?.ready) && extraMissing.length === 0 && canonicalOrderMissing.length === 0;
  const score = Math.max(0, Math.min(baseReadiness?.score ?? 0, 100 - extraMissing.length * 10));
  const showValidationErrors = hasSubmitAttempted && !ready;
  const validationErrors = {
    order: showValidationErrors && !selectedOrder ? text("Vui lòng chọn Order đã xác nhận.", "Select a confirmed Order.") : undefined,
    pickup: showValidationErrors && !selectedPickup ? text("Vui lòng chọn điểm lấy hàng.", "Select a pickup location.") : undefined,
    provider: showValidationErrors && !providerId ? text("Vui lòng chọn đơn vị vận chuyển.", "Select a carrier.") : undefined,
    service: showValidationErrors && (!serviceCode || !selectedService) ? text("Vui lòng chọn dịch vụ đang được provider hỗ trợ.", "Select a service supported by the carrier.") : undefined,
    cod: showValidationErrors && codAmount > 0 && (!selectedProvider?.capabilities?.cod || !selectedService?.supportsCod) ? text("Provider hoặc dịch vụ không hỗ trợ COD cho đơn này.", "The selected carrier or service does not support COD for this order.") : undefined,
    recipientName: showValidationErrors && !recipientName.trim() ? text("Nhập tên người nhận.", "Enter the recipient name.") : undefined,
    recipientPhone: showValidationErrors && !recipientPhone.trim()
      ? text("Nhập số điện thoại người nhận.", "Enter the recipient phone.")
      : showValidationErrors && !validatePhone(recipientPhone).valid
        ? text("Số điện thoại không hợp lệ (8–15 chữ số).", "Enter a valid phone number (8–15 digits).")
        : undefined,
    recipientEmail: showValidationErrors && recipientEmail.trim() && !validateEmail(recipientEmail).valid ? text("Email người nhận không hợp lệ.", "Enter a valid recipient email.") : undefined,
    recipientAddress: showValidationErrors && !recipientLine1.trim() ? text("Nhập địa chỉ giao hàng.", "Enter the delivery address.") : undefined,
    recipientCity: showValidationErrors && !recipientCity.trim() ? text("Nhập Tỉnh/Thành phố giao hàng.", "Enter the delivery province/city.") : undefined,
    recipientPostal: showValidationErrors && mode === "INTERNATIONAL" && !recipientPostalCode.trim() ? text("Nhập mã bưu chính.", "Enter the postal code.") : undefined,
    weight: showValidationErrors && actualWeight <= 0 ? text("Nhập tổng khối lượng hoặc khối lượng từng dòng hàng.", "Enter total weight or unit weights for goods lines.") : undefined,
    customs: showValidationErrors && mode === "INTERNATIONAL" && goodsType === "PARCEL" && !customsDescription.trim() ? text("Nhập mô tả khai báo hải quan.", "Enter the customs description.") : undefined,
  };

  const updateGoods = (id: string, patch: Partial<GoodsDraft>) => setGoods((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const addGoods = () => setGoods((current) => [...current, {
    id: `goods_${crypto.randomUUID()}`,
    productId: "",
    name: "",
    quantity: 1,
    weightGrams: 0,
    declaredValue: 0,
    hsCode: "",
    countryOfOrigin: "VN",
  }]);
  const removeGoods = (id: string) => setGoods((current) => current.filter((item) => item.id !== id));

  const submit = async () => {
    setHasSubmitAttempted(true);
    setSubmitError("");
    if (!selectedOrder || !selectedPickup || !ready) {
      setSubmitError(text(`Chưa thể tạo vận đơn: ${missingRequired.join(", ") || "vui lòng kiểm tra dữ liệu"}.`, `Shipment cannot be created: ${missingRequired.join(", ") || "please review the form"}.`));
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const target = document.querySelector<HTMLElement>("[aria-invalid='true']");
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
          target?.focus({ preventScroll: true });
        });
      });
      return;
    }
    try {
      setSubmitting(true);
      const now = new Date().toISOString();
      const id = createCreateCommandTarget("shipping");
      const shipmentGroupId = `shipment:${selectedOrder.id}:${id}`;
      const service = configuredServices.find((item) => item.code === serviceCode);
      const booking = await onCreate({
        id,
        code: `SB-${String(existingBookingCount + 1).padStart(4, "0")}`,
        orderId: selectedOrder.id,
        transportMode: mode,
        providerId,
        serviceCode,
        serviceName: service?.name ?? serviceCode,
        pickupLocationSnapshot: {
          line1: selectedPickup.addressLine,
          city: selectedPickup.city,
          name: selectedPickup.name,
          id: selectedPickup.id,
          contactName: selectedPickup.contactName,
          phone: selectedPickup.phone,
        },
        returnLocationSnapshot: {
          line1: selectedPickup.addressLine,
          city: selectedPickup.city,
          name: selectedPickup.name,
          id: selectedPickup.id,
          contactName: selectedPickup.contactName,
          phone: selectedPickup.phone,
        },
        recipientSnapshot,
        packageSnapshot: {
          ...packageSnapshot,
          note: recipientChangedFromOrder ? `Recipient override: ${recipientOverrideReason.trim()}` : packageSnapshot.note,
        },
        shipmentGroupId,
        idempotencyKey: `shipping-booking:${shipmentGroupId}:attempt:1`,
        correlationId: `corr_${id}`,
        actorId,
        actorName,
        now,
      });
      onCreated(booking, booking.bookingStatus === "BOOKED"
        ? text("Đã tạo vận đơn và lưu đầy đủ snapshot gửi, nhận, hàng hóa, COD và yêu cầu xử lý.", "Shipment created with sender, recipient, goods, COD and handling snapshots.")
        : booking.lastErrorMessage || text("Tạo vận đơn thất bại.", "Shipment creation failed."));
    } catch (error) {
      setSubmitError(formatApplicationError(error, { locale }));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    addGoods,
    canonicalOrderMissing,
    chargeableWeight,
    codAmount,
    configuredServices,
    confirmedOrders,
    customsDescription,
    declaredValue,
    deliveryMethod,
    deliveryNote,
    deliveryWindow,
    documentNames,
    effectiveDeclaredValue,
    feePayer,
    goods,
    goodsType,
    goodsWeight,
    handling,
    hasSubmitAttempted,
    heightCm,
    initialOrderId,
    initialOrderIssue,
    inspectionPolicy,
    insuranceRequested,
    invoiceNumber,
    lengthCm,
    locale,
    missingRequired,
    mode,
    onCancel,
    onOpenOrder,
    orderId,
    packageCount,
    packageType,
    pickupLocationId,
    pickupLocations,
    pickupMethod,
    pickupNote,
    pickupWindow,
    promotionCode,
    providerId,
    providers,
    ready,
    recipientChangedFromOrder,
    recipientCity,
    recipientCountryCode,
    recipientDistrict,
    recipientEmail,
    recipientLine1,
    recipientLine2,
    recipientName,
    recipientOverrideReason,
    recipientPhone,
    recipientPostalCode,
    recipientWard,
    removeGoods,
    score,
    selectedOrder,
    selectedPickup,
    selectedService,
    serviceCode,
    setCustomsDescription,
    setDeclaredValue,
    setDeliveryMethod,
    setDeliveryNote,
    setDeliveryWindow,
    setDocumentNames,
    setFeePayer,
    setGoodsType,
    setHandling,
    setHeightCm,
    setInspectionPolicy,
    setInsuranceRequested,
    setInvoiceNumber,
    setLengthCm,
    setMode,
    setOrderId,
    setPackageCount,
    setPackageType,
    setPickupLocationId,
    setPickupMethod,
    setPickupNote,
    setPickupWindow,
    setPromotionCode,
    setProviderId,
    setRecipientCity,
    setRecipientCountryCode,
    setRecipientDistrict,
    setRecipientEmail,
    setRecipientLine1,
    setRecipientLine2,
    setRecipientName,
    setRecipientOverrideReason,
    setRecipientPhone,
    setRecipientPostalCode,
    setRecipientWard,
    setServiceCode,
    setTaxIdentificationNumber,
    setTotalWeightGrams,
    setWidthCm,
    submit,
    submitError,
    submitting,
    taxIdentificationNumber,
    text,
    totalWeightGrams,
    updateGoods,
    validationErrors,
    volumetricWeightGrams,
    warnings,
    widthCm,
  };
}
