import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, FileText, Package, Plus, Save, ShoppingBag, Trash2, Truck, UserRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { relationshipRefKey, type BuyerRef } from "@/platform/identity";
import type { Contact } from "@/modules/contacts";
import type { Deal } from "@/modules/deals";
import type { Quote } from "@/modules/quotes";

import { Button, Checkbox, Input, PageHeader, SearchableSelect, SectionHeader, Select, Textarea } from "@/shared/components/ui";
import { FieldHelp } from "@/guidance";
import { ProductPickerModal, type SelectedPickerItem } from "@/modules/products";
import {
  getPaymentObligationsForOrderSnapshot,
  getPaymentMethodCatalogSnapshot,
  type PaymentFulfillmentGate,
  type PaymentMethod,
  type PaymentPlanType,
  type PaymentPurpose,
  type PaymentTerm,
  type PaymentTiming,
} from "@/modules/payments";
import { findCustomerByRelationshipRefSnapshot, getCustomerSnapshot, getCustomersSnapshot } from "@/modules/customers";
import { getOrganizationAccountSnapshot, getOrganizationAccountsSnapshot } from "@/modules/organizations";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { listWorkspaceMemberDirectory, resolveWorkspaceMemberName } from "@/platform/member-directory";
import { EffectiveFieldAccessScope, useEffectiveAccess } from "@/platform/access-control";
import { createDurableId } from "@/shared/ids";
import { useConfigurationRuntime } from "@/platform/configuration-runtime";
import { executeOrderCreation, type OrderCreationPaymentLine } from "@/workflows/order-creation";
import type { CustomerOrder, OrderAdjustment, OrderItem } from "../../domain/model/order.types";
import { calculateOrderPricing, normalizeOrderItem } from "../../domain/rules/orderCalculations";
import { normalizeSourceLineItemToOrderItem, resolveOrderSourceFromQuote } from "../../application/queries/orderQueries";
import { OrderLineItemsEditor } from "../components/OrderLineItemsEditor";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { getOrderFulfillmentFieldErrors, orderRequiresShipping, resolveOrderLineFulfillmentKind } from "../../domain/rules/orderFulfillment";
import { useCustomerSnapshots } from "../hooks/useCustomerSnapshots";
import { useOrders } from "../hooks/useOrders";
import { getQuoteConversionIssues } from "@/modules/quotes";
import { getDealStagesSnapshot, isWonStage } from "@/modules/deals";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { money } from "@/shared/money";
import { canonicalPaymentMethodCodeForKind, type PaymentAgreementSnapshot } from "@/shared/order-to-cash";
import type { useOrderFormController } from "../hooks/useOrderFormController";

type OrderFormViewController = ReturnType<typeof useOrderFormController>;

export function OrderFormView({ controller }: { controller: OrderFormViewController }) {
  const {
    contacts,
    quotes,
    deals,
    products,
    PAYMENT_TERMS,
    PAYMENT_PLAN_TYPES,
    PAYMENT_PURPOSES,
    PAYMENT_TIMINGS,
    PAYMENT_GATES,
    PAYMENT_PLAN_TYPE_LABELS,
    PAYMENT_PURPOSE_LABELS,
    PAYMENT_TIMING_LABELS,
    PAYMENT_TERM_LABELS,
    PAYMENT_GATE_LABELS,
    localizedPaymentLabel,
    customerName,
    contactName,
    nextId,
    buildOrderPaymentAgreement,
    orderId,
    searchParams,
    navigate,
    t,
    locale,
    access,
    activeReceivingAccounts,
    session,
    actorId,
    resolvedActorName,
    actorName,
    memberDirectory,
    canAssignOwner,
    orders,
    customers,
    customerRecords,
    organizations,
    isEditMode,
    orderToEdit,
    customerId,
    setCustomerId,
    contactId,
    setContactId,
    buyerRef,
    setBuyerRef,
    buyerDisplayName,
    setBuyerDisplayName,
    orderDate,
    setOrderDate,
    expectedDeliveryDate,
    setExpectedDeliveryDate,
    ownerId,
    setOwnerId,
    notes,
    setNotes,
    internalNotes,
    setInternalNotes,
    items,
    setItems,
    recipientName,
    setRecipientName,
    recipientPhone,
    setRecipientPhone,
    recipientEmail,
    setRecipientEmail,
    shippingAddressLine1,
    setShippingAddressLine1,
    shippingAddressLine2,
    setShippingAddressLine2,
    shippingWard,
    setShippingWard,
    shippingDistrict,
    setShippingDistrict,
    shippingCity,
    setShippingCity,
    shippingPostalCode,
    setShippingPostalCode,
    sourceQuoteId,
    setSourceQuoteId,
    sourceQuoteNumber,
    setSourceQuoteNumber,
    sourceDealId,
    setSourceDealId,
    sourceDealName,
    setSourceDealName,
    currency,
    setCurrency,
    orderAdjustments,
    setOrderAdjustments,
    sourceValidationError,
    setSourceValidationError,
    paymentLines,
    setPaymentLines,
    paymentAccountId,
    setPaymentAccountId,
    selectedPaymentTemplateId,
    setSelectedPaymentTemplateId,
    validationError,
    setValidationError,
    submitting,
    setSubmitting,
    isPickerOpen,
    setIsPickerOpen,
    orderIdRef,
    initializedPrefillKeyRef,
    paymentPlanTouchedRef,
    validationSummaryRef,
    saveHandlerRef,
    pendingSaveResolverRef,
    suppressNavigateAfterSaveRef,
    draftHydrated,
    setDraftHydrated,
    baselineFingerprintRef,
    draftCommitted,
    setDraftCommitted,
    existingLinkedOrder,
    buyerOptions,
    filteredContacts,
    selectedCustomer,
    selectedContact,
    resolvedOwnerName,
    ownerName,
    requiresShipping,
    paymentMethodCatalog,
    selectBuyer,
    handleBuyerChange,
    pricing,
    calculations,
    prefillKey,
    applyProducts,
    updateItem,
    updatePaymentLine,
    eligiblePaymentTemplates,
    applyPaymentTemplate,
    addPaymentInstallment,
    removePaymentInstallment,
    draftFingerprint,
    hasUnsavedChanges,
    paymentPlanTotal,
    codPlanned,
    resolvePendingSave,
    showValidationError,
    safeOrderSaveError,
    buildOrder,
    handleSubmit,
  } = controller;

  if (isEditMode && orderToEdit?.state !== "DRAFT") {
    if (!orderToEdit) {
      return (
        <div className="crm-form-page mx-auto max-w-3xl p-6">
          <PageHeader title={locale === "vi" ? "Không tìm thấy Đơn hàng" : "Order not found"} icon={<ShoppingBag size={18} />} />
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">
            {locale === "vi" ? "Đơn hàng không tồn tại hoặc bạn không có quyền xem." : "The Order does not exist or you do not have access."}
          </div>
        </div>
      );
    }
    return (
      <div className="crm-form-page mx-auto max-w-3xl p-6">
        <PageHeader
          title={locale === "vi" ? `Đơn hàng ${orderToEdit.orderNumber} đã được xác nhận` : `Order ${orderToEdit.orderNumber} is confirmed`}
          icon={<ShoppingBag size={18} />}
          actions={<Button type="button" variant="secondary" onClick={() => navigate(`/orders/${orderToEdit.id}`)}>{locale === "vi" ? "Xem chi tiết" : "View details"}</Button>}
        />
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
          {locale === "vi"
            ? "Không thể chỉnh sửa giá, sản phẩm, buyer, giao nhận hoặc kế hoạch thanh toán của Đơn hàng đã xác nhận. Hãy hủy đơn hiện tại và tạo đơn thay thế khi cần thay đổi nội dung thương mại."
            : "Price, products, buyer, delivery details and payment plan cannot be edited after confirmation. Cancel this Order and create a replacement when commercial content must change."}
        </div>
      </div>
    );
  }

  return (
    <div id="order-form-container" data-order-create-flow="v2" className="crm-form-page flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <PageHeader
          id="order-form-header"
          title={isEditMode ? (locale === "vi" ? "Chỉnh sửa Đơn hàng" : "Edit Order") : (locale === "vi" ? "Tạo Đơn hàng" : "Create Order")}
          icon={<ShoppingBag size={18} />}
          actions={<Button type="button" variant="secondary" size="sm" className="h-9 rounded-xl" onClick={() => navigate(-1)}><ArrowLeft size={14} />{locale === "vi" ? "Quay lại" : "Back"}</Button>}
        />

        <form id="order-create-form" noValidate onSubmit={handleSubmit} className="crm-form-surface space-y-5">
          {(validationError || sourceValidationError) && <p ref={validationSummaryRef} tabIndex={-1} role="alert" aria-live="assertive" className="text-xs text-slate-600">{validationError || sourceValidationError}</p>}
          {existingLinkedOrder && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
              <span>{locale === "vi" ? `Nguồn này đã có đơn ${existingLinkedOrder.orderNumber}.` : `This source already has Order ${existingLinkedOrder.orderNumber}.`}</span>
              <Button type="button" variant="secondary" size="xs" onClick={() => navigate(`/orders/${existingLinkedOrder.id}`)}>{locale === "vi" ? "Mở đơn hiện có" : "Open existing Order"}</Button>
            </div>
          )}

          <EffectiveFieldAccessScope fieldKey="buyerRef">
          <section id="order-source-context" tabIndex={-1} data-order-section="source-context" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader title={locale === "vi" ? "Nguồn đơn hàng / Ngữ cảnh" : "Order source / Context"} icon={<FileText size={14} />} />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Nguồn hiện tại" : "Current source"}</div>
                <div className="mt-1 text-sm font-semibold text-slate-800">{sourceQuoteNumber ? `${locale === "vi" ? "Báo giá" : "Quote"} ${sourceQuoteNumber}` : sourceDealName ? `${locale === "vi" ? "Cơ hội" : "Opportunity"}: ${sourceDealName}` : (locale === "vi" ? "Đơn hàng trực tiếp" : "Direct Order")}</div>
                <p className="mt-1 text-xs text-slate-500">{locale === "vi" ? "Thông tin từ nguồn được điền sẵn; bạn vẫn có thể chỉnh sửa các trường của đơn hàng." : "Source information is filled in automatically; you can still edit the order fields."}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Trạng thái tạo" : "Creation state"}</div>
                <div className="mt-2"><OrderStatusBadge state={orderToEdit?.state ?? "DRAFT"} /></div>
              </div>
            </div>
          </section>
          </EffectiveFieldAccessScope>

          <EffectiveFieldAccessScope fieldKey="shippingAddress">
          <section id="order-customer-recipient" tabIndex={-1} data-order-section="customer-recipient" data-guidance-id="orders.form.customer-recipient" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader title={locale === "vi" ? "Buyer, người phụ trách & giao nhận" : "Buyer, owner & delivery"} icon={<UserRound size={14} />} actions={<div className="flex items-center gap-2"><FieldHelp helpKey="field.orders.customer" /><FieldHelp helpKey="field.orders.recipient" /></div>} />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SearchableSelect id="order-buyer" label={locale === "vi" ? "Bên mua *" : "Buyer *"} value={buyerRef ? relationshipRefKey(buyerRef) : ""} selectedLabel={buyerDisplayName || undefined} onChange={handleBuyerChange} clearable={false} required placeholder={locale === "vi" ? "Chọn Contact hoặc Organization" : "Select a Contact or Organization"} searchPlaceholder={locale === "vi" ? "Tìm tên, email hoặc số điện thoại..." : "Search name, email or phone..."} options={buyerOptions} />
              <SearchableSelect id="order-contact" label={locale === "vi" ? "Liên hệ" : "Contact"} value={contactId} onChange={setContactId} placeholder={locale === "vi" ? "Không liên kết liên hệ" : "No linked contact"} searchPlaceholder={locale === "vi" ? "Tìm tên, email hoặc số điện thoại..." : "Search name, email or phone..."} options={filteredContacts.map((contact) => ({ value: contact.id, label: contactName(contact), description: contact.email || contact.phone || contact.id, keywords: `${contact.email || ""} ${contact.phone || ""}` }))} />
              <SearchableSelect label={locale === "vi" ? "Người phụ trách" : "Owner"} value={ownerId} selectedLabel={ownerName} onChange={setOwnerId} clearable={false} disabled={!canAssignOwner} options={memberDirectory.map((member) => ({ value: member.memberId, label: member.displayName, description: member.email }))} />
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{requiresShipping ? (locale === "vi" ? "Đơn có hàng vật lý nên cần đủ thông tin giao nhận." : "Physical goods require complete delivery information.") : (locale === "vi" ? "Đơn số hoặc dịch vụ không bắt buộc thông tin giao nhận." : "Delivery information is optional for digital goods and services.")}</p>
              <Input id="order-recipientName" label={requiresShipping ? (locale === "vi" ? "Người nhận *" : "Recipient *") : (locale === "vi" ? "Người nhận" : "Recipient")} value={recipientName} onChange={(event) => setRecipientName(event.target.value)} required={requiresShipping} />
              <Input id="order-recipientPhone" label={requiresShipping ? (locale === "vi" ? "Số điện thoại *" : "Phone *") : (locale === "vi" ? "Số điện thoại" : "Phone")} inputMode="tel" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} required={requiresShipping} />
              <Input id="order-recipientEmail" label="Email" type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} />
              <Input id="order-shippingAddressLine1" label={requiresShipping ? (locale === "vi" ? "Địa chỉ giao hàng *" : "Delivery address *") : (locale === "vi" ? "Địa chỉ giao hàng" : "Delivery address")} value={shippingAddressLine1} onChange={(event) => setShippingAddressLine1(event.target.value)} required={requiresShipping} className="lg:col-span-2" />
              <Input label={locale === "vi" ? "Địa chỉ bổ sung" : "Address line 2"} value={shippingAddressLine2} onChange={(event) => setShippingAddressLine2(event.target.value)} className="lg:col-span-2" />
              <Input label={locale === "vi" ? "Phường / Xã" : "Ward"} value={shippingWard} onChange={(event) => setShippingWard(event.target.value)} />
              <Input label={locale === "vi" ? "Quận / Huyện" : "District"} value={shippingDistrict} onChange={(event) => setShippingDistrict(event.target.value)} />
              <Input id="order-shippingCity" label={requiresShipping ? (locale === "vi" ? "Tỉnh / Thành *" : "City *") : (locale === "vi" ? "Tỉnh / Thành" : "City")} value={shippingCity} onChange={(event) => setShippingCity(event.target.value)} required={requiresShipping} />
              <Input label={locale === "vi" ? "Mã bưu chính" : "Postal code"} value={shippingPostalCode} onChange={(event) => setShippingPostalCode(event.target.value)} />
            </div>
          </section>
          </EffectiveFieldAccessScope>

          <EffectiveFieldAccessScope fieldKey="items">
          <section id="order-items" tabIndex={-1} data-order-section="order-lines" data-guidance-id="orders.form.products" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader title={locale === "vi" ? "Sản phẩm / Dòng đơn hàng" : "Products / Order lines"} icon={<Package size={14} />} />
            <OrderLineItemsEditor locale={locale} currency={currency} items={pricing.items} calculations={calculations} onOpenPicker={() => setIsPickerOpen(true)} onUpdateItem={updateItem} onRemoveItem={(id) => setItems((current) => current.filter((item) => item.id !== id))} />
          </section>
          </EffectiveFieldAccessScope>

          <EffectiveFieldAccessScope fieldKey="paymentAgreement">
          <section id="order-payment-plan" tabIndex={-1} data-order-section="payment-plan" data-guidance-id="orders.form.payment-plan" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              title={locale === "vi" ? "Kế hoạch thanh toán" : "Payment plan"}
              icon={<CreditCard size={14} />}
              actions={(
                <div className="flex items-center gap-2">
                  <FieldHelp helpKey="field.orders.payment-plan" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Plus size={14} />}
                    className="min-w-[132px]"
                    onClick={addPaymentInstallment}
                  >
                    {locale === "vi" ? "Thêm đợt" : "Add installment"}
                  </Button>
                </div>
              )}
            />

                        {eligiblePaymentTemplates.length > 0 && <div className="mb-4 grid gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><Select label={locale === "vi" ? "Mẫu kế hoạch thanh toán" : "Payment-plan template"} value={selectedPaymentTemplateId} onChange={(event) => setSelectedPaymentTemplateId(event.target.value)}><option value="">{locale === "vi" ? "Chọn mẫu phù hợp" : "Select an eligible template"}</option>{eligiblePaymentTemplates.map((template) => <option key={template.id} value={template.id}>{locale === "vi" ? template.nameVi : template.nameEn}{template.approvalRequired ? ` · ${locale === "vi" ? "cần duyệt" : "approval required"}` : ""}</option>)}</Select><Button type="button" actionIntent="confirm" disabled={!selectedPaymentTemplateId} onClick={applyPaymentTemplate}>{locale === "vi" ? "Áp dụng mẫu" : "Apply template"}</Button></div>}

            <div className="space-y-4">
              {paymentLines.map((line, index) => (
                <div key={line.localId} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {locale === "vi" ? `Đợt thanh toán ${index + 1}` : `Payment installment ${index + 1}`}
                      </div>
                      <div className="mt-1 break-words text-sm font-semibold text-slate-900">
                        {line.label || (locale === "vi" ? `Đợt ${index + 1}` : `Installment ${index + 1}`)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      icon={<Trash2 size={13} />}
                      disabled={paymentLines.length === 1}
                      onClick={() => removePaymentInstallment(line.localId)}
                      aria-label={`${locale === "vi" ? "Xóa đợt" : "Remove installment"} ${index + 1}`}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      {locale === "vi" ? "Xóa đợt" : "Remove"}
                    </Button>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Input
                      label={locale === "vi" ? "Tên đợt thanh toán" : "Installment name"}
                      value={line.label}
                      onChange={(event) => updatePaymentLine(line.localId, { label: event.target.value })}
                      className="h-11 text-sm"
                    />
                    <Select
                      label={locale === "vi" ? "Cách chia thanh toán" : "Payment split"}
                      value={line.planType}
                      onChange={(event) => updatePaymentLine(line.localId, { planType: event.target.value as PaymentPlanType })}
                      className="h-11 text-sm"
                    >
                      {PAYMENT_PLAN_TYPES.map((value) => (
                        <option key={value} value={value}>{localizedPaymentLabel(PAYMENT_PLAN_TYPE_LABELS, value, locale)}</option>
                      ))}
                    </Select>
                    <Select
                      label={locale === "vi" ? "Mục đích khoản thu" : "Payment purpose"}
                      value={line.purpose}
                      onChange={(event) => updatePaymentLine(line.localId, { purpose: event.target.value as PaymentPurpose })}
                      className="h-11 text-sm"
                    >
                      {PAYMENT_PURPOSES.map((value) => (
                        <option key={value} value={value}>{localizedPaymentLabel(PAYMENT_PURPOSE_LABELS, value, locale)}</option>
                      ))}
                    </Select>
                    <Select
                      label={locale === "vi" ? "Thời điểm thu tiền" : "Collection timing"}
                      value={line.timing}
                      onChange={(event) => updatePaymentLine(line.localId, { timing: event.target.value as PaymentTiming })}
                      disabled={line.method === "COD"}
                      className="h-11 text-sm"
                    >
                      {PAYMENT_TIMINGS.map((value) => (
                        <option key={value} value={value}>{localizedPaymentLabel(PAYMENT_TIMING_LABELS, value, locale)}</option>
                      ))}
                    </Select>
                    <Select
                      label={locale === "vi" ? "Điều khoản thanh toán" : "Payment terms"}
                      value={line.term}
                      onChange={(event) => updatePaymentLine(line.localId, { term: event.target.value as PaymentTerm })}
                      className="h-11 text-sm"
                    >
                      {PAYMENT_TERMS.map((value) => (
                        <option key={value} value={value}>{localizedPaymentLabel(PAYMENT_TERM_LABELS, value, locale)}</option>
                      ))}
                    </Select>
                    <Select
                      label={locale === "vi" ? "Phương thức thanh toán" : "Payment method"}
                      value={line.method}
                      onChange={(event) => updatePaymentLine(line.localId, { method: event.target.value as PaymentMethod })}
                      className="h-11 text-sm"
                    >
                      {paymentMethodCatalog.map((method) => (
                        <option key={method.code} value={method.kind}>{locale === "vi" ? method.displayNameVi : method.displayNameEn}</option>
                      ))}
                    </Select>
                    <Select
                      label={locale === "vi" ? "Điều kiện thực hiện đơn" : "Fulfillment condition"}
                      value={line.fulfillmentGate}
                      onChange={(event) => updatePaymentLine(line.localId, { fulfillmentGate: event.target.value as PaymentFulfillmentGate })}
                      disabled={line.method === "COD"}
                      className="h-11 text-sm"
                    >
                      {PAYMENT_GATES.map((value) => (
                        <option key={value} value={value}>{localizedPaymentLabel(PAYMENT_GATE_LABELS, value, locale)}</option>
                      ))}
                    </Select>
                    <Input
                      id={`order-payment-amount-${index}`}
                      label={locale === "vi" ? "Số tiền theo lịch" : "Scheduled amount"}
                      type="number"
                      min={0}
                      value={line.amountDue}
                      onChange={(event) => updatePaymentLine(line.localId, { amountDue: Number(event.target.value) })}
                      className="h-11 text-sm"
                    />
                    <Input
                      label={locale === "vi" ? "Ngày đến hạn" : "Due date"}
                      type="date"
                      value={line.dueDate}
                      onChange={(event) => updatePaymentLine(line.localId, { dueDate: event.target.value })}
                      className="h-11 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            {paymentLines.some((line) => line.method === "BANK_TRANSFER") && (
              <div className="mt-4 grid gap-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <Select
                  label={locale === "vi" ? "Tài khoản nhận tiền" : "Receiving account"}
                  value={paymentAccountId}
                  onChange={(event) => setPaymentAccountId(event.target.value)}
                  className="h-11 text-sm"
                >
                  <option value="">{locale === "vi" ? "Chưa cấu hình tài khoản" : "No account configured"}</option>
                  {activeReceivingAccounts.filter((account) => account.currency === currency).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.nickname} · {account.bankName} · {account.accountNumber}
                    </option>
                  ))}
                </Select>
                <div className="rounded-xl border border-violet-100 bg-white p-3 text-xs text-slate-600">
                  <div className="font-semibold text-slate-800">{locale === "vi" ? "Payment instruction snapshot" : "Payment instruction snapshot"}</div>
                  <p className="mt-1 leading-relaxed">
                    {paymentAccountId
                      ? (locale === "vi" ? "Khi lưu, Order giữ bản chụp tài khoản, nội dung chuyển khoản và payload QR theo phiên bản cấu hình workspace hiện tại." : "Saving captures the account, transfer content and QR payload from the current workspace configuration version.")
                      : (locale === "vi" ? "Order vẫn lưu được nhưng sẽ không có thông tin tài khoản/QR. Thông tin tài khoản nhận tiền chưa được cấu hình cho workspace." : "The Order can still be saved, but it will not include account or QR guidance. Receiving-account information is not configured for this workspace.")}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 leading-relaxed text-slate-500">
                {locale === "vi"
                  ? "Phương thức thanh toán và điều khoản thanh toán là hai khái niệm độc lập. COD không tự đánh dấu Order đã thanh toán."
                  : "Payment method and payment terms are independent. COD never marks the Order as paid by itself."}
              </span>
              <span className={`shrink-0 whitespace-nowrap font-semibold ${Math.abs(paymentPlanTotal - calculations.grandTotal) < 0.01 ? "text-emerald-700" : "text-rose-700"}`}>
                {paymentPlanTotal.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")} / {calculations.grandTotal.toLocaleString(locale === "vi" ? "vi-VN" : "en-US")} {currency}
              </span>
            </div>
          </section>
          </EffectiveFieldAccessScope>

          <EffectiveFieldAccessScope fieldKey="shippingAddress">
          <section data-order-section="optional-shipping" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader title={locale === "vi" ? "Bước vận chuyển tiếp theo" : "Next shipping step"} icon={<Truck size={14} />} />
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{locale === "vi" ? "Đơn hàng được lưu ở trạng thái nháp. Sau khi xác nhận Order và payment gate cho phép, bạn có thể mở trang tạo vận đơn với người nhận, địa chỉ, sản phẩm và COD được điền sẵn để bổ sung khối lượng thực tế và dịch vụ vận chuyển." : "The Order is saved as a draft. After confirmation and payment-gate approval, you can open the Shipping page with recipient, address, products and COD prefilled, then complete weight and shipping-service details."}</p>
          </section>
          </EffectiveFieldAccessScope>

          <section data-order-section="summary" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader title={locale === "vi" ? "Tổng kết" : "Summary"} icon={<ShoppingBag size={14} />} />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Input label={locale === "vi" ? "Ngày đặt hàng" : "Order date"} type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
              <Input label={locale === "vi" ? "Dự kiến giao" : "Expected delivery"} type="date" value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Giá trị đơn hàng" : "Order total"}</div><div className="mt-1 text-lg font-semibold text-slate-900">{calculations.grandTotal.toLocaleString("vi-VN")} {currency}</div></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold text-slate-500">{locale === "vi" ? "Vận đơn" : "Shipping"}</div><div className="mt-1 text-sm font-semibold text-slate-800">{requiresShipping ? (locale === "vi" ? "Tạo sau khi đơn hàng được xác nhận và điều kiện thanh toán cho phép" : "Create after Order confirmation and payment-gate approval") : (locale === "vi" ? "Không cần vận đơn" : "No shipment required")}</div></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><Textarea label={locale === "vi" ? "Ghi chú giao dịch" : "Customer notes"} value={notes} onChange={(event) => setNotes(event.target.value)} /><Textarea label={locale === "vi" ? "Ghi chú cho đội ngũ" : "Team notes"} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></div>
          </section>

          <div data-order-form-actions="v2" data-mobile-action-bar="true" className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <Button type="button" variant="secondary" size="sm" className="h-9 rounded-xl" onClick={() => navigate(-1)}>{t("common.cancel")}</Button>
            <Button type="submit" variant="primary" size="md" className="min-w-28" disabled={submitting || Boolean(existingLinkedOrder) || Boolean(sourceValidationError)} data-guidance-id="orders.form.save"><Save size={14} />{submitting ? (locale === "vi" ? "Đang lưu..." : "Saving...") : t("common.save")}</Button>
          </div>
        </form>
      </div>

      <ProductPickerModal id="order-product-picker" isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} onApply={applyProducts} products={products} context="order" />
    </div>
  );
}
