import {
  ArrowLeft,
  Box,
  ClipboardList,
  FileText,
  MapPin,
  PackageCheck,
  Plus,
  ReceiptText,
  Send,
  Trash2,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Button, Checkbox, FormSection, Input, SearchableSelect, Select, Textarea } from "@/shared/components/ui";
import { ModulePageShell } from "@/components/crm/ModulePageShell";
import { PageHeader } from "@/shared/components/ui";
import { formatShippingMoney as money, handlingLabels } from "./shippingBookingCreateModel";
import { ShippingBookingActionBar, ShippingInitialOrderIssue, ShippingPreBookingSummary, ShippingReadinessAlert, ShippingTransportModeSelector } from "./ShippingBookingCreatePresentation";
import { useShippingBookingCreateController } from "./useShippingBookingCreateController";

type ShippingBookingCreateController = ReturnType<typeof useShippingBookingCreateController>;

export function ShippingBookingCreateView({ controller }: { controller: ShippingBookingCreateController }) {
  const {
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
  } = controller;
  return (
    <ModulePageShell id="create-shipping-booking-page" className="!max-w-none overflow-x-clip bg-slate-100/70 text-slate-700">
      <div className="mx-auto w-full max-w-[1480px] min-w-0 space-y-5 px-4 py-4 pb-32 sm:px-6 lg:pb-36">
        <PageHeader
          id="create-shipping-booking-page-header"
          title={text("Tạo vận đơn", "Create shipment")}
          icon={<Truck size={18} />}
          actions={<Button type="button" actionIntent="neutral" size="md" icon={<ArrowLeft size={14} />} onClick={onCancel}>{text("Quay lại", "Back")}</Button>}
        />
        <ShippingInitialOrderIssue issue={initialOrderIssue} orderId={initialOrderId} onOpenOrder={onOpenOrder} text={text} />
        <div className="crm-form-page !max-w-none min-w-0 space-y-5 !pb-0">
          <div className="min-w-0 space-y-5">
        <ShippingTransportModeSelector mode={mode} onChange={setMode} text={text} />

        <ShippingReadinessAlert
          visible={hasSubmitAttempted && (!ready || Boolean(submitError))}
          ready={ready}
          score={score}
          missingRequired={missingRequired}
          warnings={warnings}
          submitError={submitError}
          selectedOrder={selectedOrder}
          canonicalOrderMissing={canonicalOrderMissing}
          onOpenOrder={onOpenOrder}
          text={text}
        />

        <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
          <div className="min-w-0 space-y-5">
            <FormSection title={text("Nguồn đơn và người gửi", "Order source and sender")} icon={<Send size={16} />}>
              <div className="space-y-4">
                <SearchableSelect
                  id="shipping-order-search"
                  label={text("Đơn hàng *", "Order *")}
                  value={orderId}
                  onChange={setOrderId}
                  placeholder={text("Chọn đơn hàng đã xác nhận", "Select a confirmed order")}
                  searchPlaceholder={text("Tìm theo mã đơn, customer hoặc số điện thoại...", "Search by order, customer or phone...")}
                  emptyText={text("Không tìm thấy đơn hàng phù hợp", "No matching order found")}
                  clearable={false}
                  error={validationErrors.order}
                  options={confirmedOrders.map((order) => ({ value: order.id, label: order.orderNumber, description: `${order.customerName ?? order.buyerRef.id} · ${money(order.grandTotal ?? order.totalAmount, order.currency ?? "VND", locale)}`, keywords: `${order.orderNumber} ${order.customerName ?? ""} ${order.recipientPhone ?? ""}` }))}
                />
                <SearchableSelect
                  id="shipping-pickup-location-search"
                  label={text("Điểm lấy hàng *", "Pickup location *")}
                  value={pickupLocationId}
                  onChange={setPickupLocationId}
                  placeholder={text("Chọn người gửi / điểm lấy hàng", "Select sender / pickup location")}
                  searchPlaceholder={text("Tìm tên, số điện thoại hoặc địa chỉ...", "Search name, phone or address...")}
                  clearable={false}
                  error={validationErrors.pickup}
                  options={pickupLocations.map((item) => ({ value: item.id, label: item.name, description: `${item.contactName} · ${item.phone} · ${item.addressLine}, ${item.city}`, keywords: `${item.contactName} ${item.phone} ${item.addressLine} ${item.city}` }))}
                />
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                  <div><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{text("Người gửi", "Sender")}</div><div className="mt-1 text-sm font-medium text-slate-900">{selectedPickup?.contactName || "—"}</div><div className="mt-1 text-xs text-slate-500">{selectedPickup?.phone || "—"}</div></div>
                  <div><div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{text("Địa chỉ lấy hàng", "Pickup address")}</div><div className="mt-1 text-sm font-medium text-slate-800">{selectedPickup ? `${selectedPickup.addressLine}, ${selectedPickup.city}` : "—"}</div></div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-600">{text("Phương thức gửi", "Pickup method")}</div>
                  <div className="grid gap-2 sm:grid-cols-3">{[
                    ["ADDRESS", text("Lấy tại địa chỉ", "Pickup at address")],
                    ["SMART_BOX", "Smart Box"],
                    ["POST_OFFICE", text("Gửi tại bưu cục", "Drop at post office")],
                  ].map(([value, label]) => <button key={value} type="button" onClick={() => setPickupMethod(value as typeof pickupMethod)} className={`rounded-xl border px-3 py-2.5 text-xs font-medium ${pickupMethod === value ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{label}</button>)}</div>
                </div>
                <Input id="shipping-pickup-window" type="datetime-local" label={text("Thời gian hẹn lấy", "Pickup appointment")} value={pickupWindow} onChange={(event) => setPickupWindow(event.target.value)} />
              </div>
            </FormSection>

            <FormSection title={text("Người nhận", "Recipient")} icon={<UserRound size={16} />}>
              <div className="grid items-start gap-4 md:grid-cols-2">
                <Input id="shipping-recipient-phone" label={text("Điện thoại *", "Phone *")} inputMode="tel" error={validationErrors.recipientPhone} value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder={text("Nhập số điện thoại người nhận", "Enter recipient phone")} />
                <Input id="shipping-recipient-name" label={text("Họ tên *", "Full name *")} error={validationErrors.recipientName} value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder={text("Nhập tên người nhận", "Enter recipient name")} />
                <Input id="shipping-recipient-email" label="Email" type="email" error={validationErrors.recipientEmail} value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="email@example.com" />
                {mode === "INTERNATIONAL" && <Input id="shipping-recipient-country" label={text("Mã quốc gia nhận *", "Destination country code *")} value={recipientCountryCode} onChange={(event) => setRecipientCountryCode(event.target.value.toUpperCase())} placeholder={text("US, SG, JP...", "US, SG, JP...")} />}
                <Input id="shipping-recipient-address" label={text("Địa chỉ *", "Address *")} error={validationErrors.recipientAddress} value={recipientLine1} onChange={(event) => setRecipientLine1(event.target.value)} placeholder={text("Số nhà, đường, tòa nhà...", "Street, building, house number...")} className="sm:col-span-2" />
                <Input id="shipping-recipient-address-2" label={text("Địa chỉ bổ sung", "Address line 2")} value={recipientLine2} onChange={(event) => setRecipientLine2(event.target.value)} placeholder={text("Căn hộ, tầng, chỉ dẫn...", "Apartment, floor, directions...")} className="sm:col-span-2" />
                <Input id="shipping-recipient-city" label={text("Tỉnh / Thành phố *", "Province / City *")} error={validationErrors.recipientCity} value={recipientCity} onChange={(event) => setRecipientCity(event.target.value)} />
                <Input id="shipping-recipient-district" label={text("Quận / Huyện", "District")} value={recipientDistrict} onChange={(event) => setRecipientDistrict(event.target.value)} />
                <Input id="shipping-recipient-ward" label={text("Phường / Xã", "Ward")} value={recipientWard} onChange={(event) => setRecipientWard(event.target.value)} />
                <Input id="shipping-recipient-postal" label={mode === "INTERNATIONAL" ? text("Mã bưu chính *", "Postal code *") : text("Mã bưu chính", "Postal code")} error={validationErrors.recipientPostal} value={recipientPostalCode} onChange={(event) => setRecipientPostalCode(event.target.value)} />
                <div className="sm:col-span-2">
                  <div className="mb-2 text-xs font-medium text-slate-600">{text("Phương thức nhận", "Delivery method")}</div>
                  <div className="grid gap-2 sm:grid-cols-3">{[
                    ["ADDRESS", text("Giao tại địa chỉ", "Deliver to address")],
                    ["SMART_BOX", "Smart Box"],
                    ["POST_OFFICE", text("Nhận tại bưu cục", "Collect at post office")],
                  ].map(([value, label]) => <button key={value} type="button" onClick={() => setDeliveryMethod(value as typeof deliveryMethod)} className={`rounded-xl border px-3 py-2.5 text-xs font-medium ${deliveryMethod === value ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{label}</button>)}</div>
                </div>
                {recipientChangedFromOrder && <Textarea id="shipping-recipient-override-reason" label={text("Lý do thay đổi so với Order *", "Reason for overriding Order recipient *")} value={recipientOverrideReason} onChange={(event) => setRecipientOverrideReason(event.target.value)} rows={2} className="sm:col-span-2" />}
                {mode === "INSTANT" && <Input id="shipping-delivery-window" type="datetime-local" label={text("Thời gian giao dự kiến *", "Expected delivery time *")} value={deliveryWindow} onChange={(event) => setDeliveryWindow(event.target.value)} className="sm:col-span-2" />}
              </div>
            </FormSection>

            <FormSection title={text("Chọn dịch vụ", "Shipping service")} icon={<Truck size={16} />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SearchableSelect id="shipping-provider-search" label={text("Đơn vị vận chuyển *", "Carrier *")} error={validationErrors.provider} value={providerId} onChange={setProviderId} placeholder={text("Chọn đơn vị vận chuyển", "Select carrier")} searchPlaceholder={text("Tìm đơn vị vận chuyển...", "Search carriers...")} clearable={false} options={providers.map((provider) => ({ value: provider.id, label: provider.name, description: `${provider.environment ?? "SANDBOX"} · ${provider.code ?? provider.id}` }))} />
                <SearchableSelect id="shipping-service-search" label={text("Dịch vụ chính *", "Primary service *")} error={validationErrors.service} value={serviceCode} onChange={setServiceCode} placeholder={text("Chọn dịch vụ", "Select service")} searchPlaceholder={text("Tìm dịch vụ...", "Search services...")} clearable={false} options={configuredServices.map((service) => ({ value: service.code, label: service.name, description: [service.estimatedDays != null ? `${service.estimatedDays} ${text("ngày", "days")}` : "", service.supportsCod ? "COD" : text("Không COD", "No COD")].filter(Boolean).join(" · ") }))} />
                <Input id="shipping-promotion-code" label={text("Mã khuyến mại", "Promotion code")} value={promotionCode} onChange={(event) => setPromotionCode(event.target.value)} placeholder={text("Nhập mã nếu có", "Enter a code if available")} />
                {mode !== "INSTANT" && <Input id="shipping-delivery-window-optional" type="datetime-local" label={text("Hạn giao mong muốn", "Requested delivery deadline")} value={deliveryWindow} onChange={(event) => setDeliveryWindow(event.target.value)} />}
              </div>
            </FormSection>
          </div>

          <div className="min-w-0 space-y-5">
            <FormSection className="min-w-0 overflow-hidden" title={text("Thông tin hàng hóa", "Goods information")} icon={<Box size={16} />}>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select id="shipping-goods-type" label={text("Loại hàng hóa", "Goods type")} value={goodsType} onChange={(event) => setGoodsType(event.target.value as typeof goodsType)}><option value="PARCEL">{text("Bưu kiện / hàng hóa", "Parcel / goods")}</option><option value="DOCUMENT">{text("Tài liệu", "Documents")}</option></Select>
                  <Select id="shipping-package-type" label={text("Loại bao bì", "Package type")} value={packageType} onChange={(event) => setPackageType(event.target.value as typeof packageType)}><option value="BOX">{text("Thùng hộp", "Box")}</option><option value="ENVELOPE">{text("Phong bì / túi", "Envelope / pouch")}</option><option value="PALLET">Pallet</option><option value="TUBE">{text("Ống", "Tube")}</option><option value="OTHER">{text("Khác", "Other")}</option></Select>
                </div>

                <div className="space-y-3">
                  {goods.map((item, index) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-xs font-medium text-slate-900">{text("Hàng hóa", "Goods item")} {index + 1}</div>{item.sku && <div className="mt-0.5 font-mono text-[10px] text-slate-500">{item.sku}</div>}</div><button type="button" onClick={() => removeGoods(item.id)} disabled={goods.length <= 1} className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30" aria-label={text("Xóa hàng hóa", "Remove goods item")}><Trash2 size={14} /></button></div>
                      <div className="grid min-w-0 gap-3">
                        <Input id={`shipping-goods-name-${item.id}`} label={text("Tên hàng *", "Goods name *")} value={item.name} onChange={(event) => updateGoods(item.id, { name: event.target.value })} className="min-w-0" />
                        <div className="grid min-w-0 items-start gap-3 sm:grid-cols-3">
                          <Input id={`shipping-goods-quantity-${item.id}`} type="number" min={1} label={text("Số lượng *", "Quantity *")} value={item.quantity} onChange={(event) => updateGoods(item.id, { quantity: Number(event.target.value) })} className="min-w-0" />
                          <Input id={`shipping-goods-weight-${item.id}`} type="number" min={0} label={text("Khối lượng / đơn vị (g)", "Unit weight (g)")} value={item.weightGrams} onChange={(event) => updateGoods(item.id, { weightGrams: Number(event.target.value) })} className="min-w-0" />
                          <Input id={`shipping-goods-value-${item.id}`} type="number" min={0} label={text("Giá trị dòng hàng", "Line value")} value={item.declaredValue} onChange={(event) => updateGoods(item.id, { declaredValue: Number(event.target.value) })} className="min-w-0" />
                        </div>
                        {mode === "INTERNATIONAL" && <div className="grid min-w-0 gap-3 sm:grid-cols-2"><Input id={`shipping-goods-hs-${item.id}`} label={text("HS Code", "HS Code")} value={item.hsCode} onChange={(event) => updateGoods(item.id, { hsCode: event.target.value })} className="min-w-0" /><Input id={`shipping-goods-origin-${item.id}`} label={text("Xuất xứ", "Country of origin")} value={item.countryOfOrigin} onChange={(event) => updateGoods(item.id, { countryOfOrigin: event.target.value.toUpperCase() })} className="min-w-0" /></div>}
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" size="sm" icon={<Plus size={13} />} onClick={addGoods}>{text("Thêm hàng hóa", "Add goods item")}</Button>
                </div>

                <div className="grid min-w-0 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
                  <Input id="shipping-package-count" type="number" min={1} label={text("Số kiện *", "Package count *")} value={packageCount} onChange={(event) => setPackageCount(Number(event.target.value))} />
                  <Input id="shipping-total-weight" type="number" min={0} label={text("Tổng khối lượng thực (g) *", "Actual total weight (g) *")} error={validationErrors.weight} value={totalWeightGrams} onChange={(event) => setTotalWeightGrams(Number(event.target.value))} placeholder={goodsWeight > 0 ? String(goodsWeight) : "0"} />
                  <Input id="shipping-declared-value" type="number" min={0} label={text("Tổng giá trị khai báo", "Declared value")} value={declaredValue} onChange={(event) => setDeclaredValue(Number(event.target.value))} />
                  <div className="flex items-end"><Checkbox id="shipping-insurance" checked={insuranceRequested} onChange={(event) => setInsuranceRequested(event.target.checked)} label={text("Mua bảo hiểm hàng hóa", "Request shipment insurance")} /></div>
                  <Input id="shipping-length" type="number" min={1} label={text("Dài (cm)", "Length (cm)")} value={lengthCm} onChange={(event) => setLengthCm(Number(event.target.value))} />
                  <Input id="shipping-width" type="number" min={1} label={text("Rộng (cm)", "Width (cm)")} value={widthCm} onChange={(event) => setWidthCm(Number(event.target.value))} />
                  <Input id="shipping-height" type="number" min={1} label={text("Cao (cm)", "Height (cm)")} value={heightCm} onChange={(event) => setHeightCm(Number(event.target.value))} />
                  <div className="flex min-h-[72px] min-w-0 flex-col justify-center rounded-xl border border-violet-100 bg-violet-50 px-3.5 py-2.5"><div className="text-[10px] font-medium uppercase tracking-wide text-violet-500">{text("Khối lượng quy đổi tham khảo", "Reference volumetric weight")}</div><div className="mt-1 text-sm font-medium text-violet-900">{new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(volumetricWeightGrams)} g</div></div>
                </div>
              </div>
            </FormSection>

            <FormSection title={text("Tính chất hàng hóa đặc biệt", "Special goods characteristics")} icon={<PackageCheck size={16} />}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {handlingLabels.map((item) => <Checkbox key={item.key} id={`shipping-handling-${item.key}`} checked={Boolean(handling[item.key])} onChange={(event) => setHandling((current) => ({ ...current, [item.key]: event.target.checked }))} label={text(item.vi, item.en)} />)}
              </div>
              {(handling.hazardousGoods || handling.containsBattery || handling.liquid) && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-relaxed text-amber-800">{text("Các mặt hàng có điều kiện cần được kiểm tra quy cách đóng gói, tuyến vận chuyển và chứng từ với provider trước khi booking.", "Conditional goods require packaging, route and document checks with the carrier before booking.")}</div>}
            </FormSection>

            {mode === "INTERNATIONAL" && <FormSection title={text("Hải quan và chứng từ", "Customs and documents")} icon={<FileText size={16} />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Textarea id="shipping-customs-description" label={text("Mô tả gói hàng *", "Contents description *")} error={validationErrors.customs} value={customsDescription} onChange={(event) => setCustomsDescription(event.target.value)} rows={3} className="sm:col-span-2" />
                <Input id="shipping-invoice-number" label={text("Số hóa đơn / chứng từ", "Invoice / document number")} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
                <Input id="shipping-tax-identification" label={text("Mã số thuế / định danh", "Tax / identity number")} value={taxIdentificationNumber} onChange={(event) => setTaxIdentificationNumber(event.target.value)} />
                <label className="space-y-1.5 sm:col-span-2"><span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">{text("Hồ sơ đính kèm", "Attached documents")}</span><input type="file" multiple onChange={(event) => setDocumentNames(Array.from(event.target.files ?? []).map((file) => file.name))} className="block min-h-11 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-violet-700" /></label>
                {documentNames.length > 0 && <div className="sm:col-span-2 flex flex-wrap gap-2">{documentNames.map((name) => <span key={name} className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{name}</span>)}</div>}
              </div>
            </FormSection>}

            <FormSection title={text("Tiền thu hộ, người trả cước và ghi chú", "COD, fee payer and notes")} icon={<WalletCards size={16} />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-medium text-slate-800"><ReceiptText size={15} />COD</div><div className="mt-2 text-xl font-semibold text-slate-900">{money(codAmount, selectedOrder?.currency ?? "VND", locale)}</div><p className="mt-1 text-[11px] leading-relaxed text-slate-600">{text("Chỉ đọc từ nghĩa vụ COD còn mở trong Payment; muốn thay đổi cần sửa Payment plan của Order.", "Read-only from open COD obligations in Payment; change the Order payment plan to modify it.")}</p>{validationErrors.cod && <p className="mt-2 text-[11px] text-slate-600">{validationErrors.cod}</p>}</div>
                <div className="space-y-4"><Select id="shipping-fee-payer" label={text("Người trả cước", "Fee payer")} value={feePayer} onChange={(event) => setFeePayer(event.target.value as typeof feePayer)}><option value="SENDER">{text("Người gửi", "Sender")}</option><option value="RECIPIENT">{text("Người nhận", "Recipient")}</option></Select><Select id="shipping-inspection-policy" label={text("Chính sách kiểm hàng", "Inspection policy")} value={inspectionPolicy} onChange={(event) => setInspectionPolicy(event.target.value as typeof inspectionPolicy)}><option value="ALLOW_TRY">{text("Cho thử hàng", "Allow trial")}</option><option value="VIEW_ONLY">{text("Chỉ xem hàng", "View only")}</option><option value="NO_OPEN">{text("Không mở hàng", "Do not open")}</option></Select></div>
                <Textarea id="shipping-pickup-note" label={text("Ghi chú lấy hàng", "Pickup note")} value={pickupNote} onChange={(event) => setPickupNote(event.target.value)} rows={2} placeholder={text("Ví dụ: gọi kho trước 30 phút...", "Example: call the warehouse 30 minutes ahead...")} />
                <Textarea id="shipping-delivery-note" label={text("Ghi chú giao hàng", "Delivery note")} value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} rows={2} placeholder={text("Ví dụ: gọi trước khi giao, không để ngoài trời...", "Example: call before delivery, keep indoors...")} />
              </div>
            </FormSection>
          </div>
        </div>

        <FormSection title={text("Tóm tắt trước khi gửi booking", "Pre-booking summary")} icon={<ClipboardList size={16} />}>
          <ShippingPreBookingSummary selectedPickup={selectedPickup} recipientCity={recipientCity} recipientCountryCode={recipientCountryCode} goods={goods} packageCount={packageCount} effectiveDeclaredValue={effectiveDeclaredValue} selectedOrder={selectedOrder} locale={locale} selectedServiceName={selectedService?.name} serviceCode={serviceCode} text={text} />
        </FormSection>
          </div>
        </div>
      </div>

      <ShippingBookingActionBar codAmount={codAmount} selectedOrder={selectedOrder} locale={locale} chargeableWeight={chargeableWeight} hasSubmitAttempted={hasSubmitAttempted} ready={ready} score={score} submitting={submitting} onCancel={onCancel} onSubmit={submit} text={text} />
    </ModulePageShell>
  );;
}
