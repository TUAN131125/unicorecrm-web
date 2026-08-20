import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { 
  AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, Landmark, Mail, MessageCircle, Percent, Plus, PlusCircle, Save, ShieldCheck, ShoppingBag, Trash2
} from "lucide-react";
import type { CustomerDisplay as Customer } from "@/modules/customers";
import type { CrmWorkspaceConfig } from "@/platform/workspace-config";
import { getQuoteDocumentLabel, useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";

import { DealStage, updateDeals, type Deal, type DealActivity } from "@/modules/deals";
import { validateQuoteDraft } from "../../application/queries/quoteDraftValidation";
import { QuoteApprovalStatus, QuoteStatus, SalesDocumentAdjustmentType, type Quote, type QuoteDeliveryChannel, type QuoteLineItem, type QuotePaymentMethod, type QuotePaymentTiming, type SalesDocumentAdjustment } from "../../domain/model/quote.types";
import { applyQuoteApprovalAssessment, canQuoteBeSent, DEFAULT_QUOTE_APPROVAL_POLICY, evaluateQuoteApproval } from "../../domain/rules/quoteApprovalPolicy";
import { normalizeQuoteLineItem } from "../../domain/rules/quoteCalculations";
import { getQuoteConversionIssues } from "../../domain/rules/quoteConversion";
import { calculateQuoteDraftTotals } from "../../domain/rules/quoteDraftPricing";
import { isQuoteVersionImmutable, quoteContentFingerprint } from "../../domain/rules/quoteVersioning";
import { allocateQuoteIdentitySnapshot, createQuoteRevisionCommand, recordQuoteDeliverySnapshot, requestQuoteApprovalCommand, saveQuoteSnapshotAsync } from "../../public/quotes";

import { useQuotes } from "../hooks/useQuotes";
import { useDeals } from "../hooks/useDeals";
import { DEFAULT_CRM_WORKSPACE_CONFIG } from "@/platform/workspace-config/workspaceConfigDefaults";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/shared/lib/format/currency";
import { Input, SearchableSelect, Select, Textarea, Button, Badge, PageHeader, SectionHeader, getQuoteStatusBadgeVariant, Table, TableHeader, TableBody, TableRow, TableCell } from "@/shared/components/ui";
import { getProductCatalogSnapshot } from "@/modules/products";
import { getCustomerSnapshot } from "@/modules/customers";
import { QuoteBuilderPreview } from "../components/QuoteBuilderPreview";
import { QuoteBuilderProductPicker } from "../components/QuoteBuilderProductPicker";
import {
  QuoteDeliveryConfirmationModal,
  type QuoteDeliveryConfirmationValue,
} from "../components/QuoteDeliveryConfirmationModal";
import { createQuotePdfFromElement, downloadQuotePdf } from "../services/quotePdfExport";
import { launchQuoteGmailDelivery } from "../services/quoteGmailDelivery";
import { usePlatformState } from "@/platform/application-state";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { getPaymentMethodCatalogSnapshot } from "@/modules/payments";
import { formatMoneyDto, money } from "@/shared/money";
import { createDurableId } from "@/shared/ids";
import { OperationGuideButton } from "@/components/crm/OperationGuide";
import { EffectiveFieldAccessScope } from "@/platform/access-control";
import { canonicalPaymentMethodCodeForKind, canonicalPaymentMethodKindForCode, isCanonicalCodMethodCode, type PaymentAgreementLineSnapshot, type PaymentAgreementSnapshot, type PaymentFulfillmentGate, type PaymentPurpose } from "@/shared/order-to-cash";
import type { useQuoteBuilderController } from "../hooks/useQuoteBuilderController";

type QuoteBuilderViewController = ReturnType<typeof useQuoteBuilderController>;

export function QuoteBuilderView({ controller }: { controller: QuoteBuilderViewController }) {
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const {
    crmConfig,
    customers,
    allocateAgreementLineId,
    legacyAgreementDraftLine,
    draftLinesFromAgreement,
    buildPaymentAgreementSnapshot,
    resolveBuyerRefFromCustomer,
    navigate,
    t,
    locale,
    operationGuide,
    session,
    actorId,
    quotes,
    deals,
    products,
    paymentMethods,
    currency,
    setCurrency,
    setDeals,
    quoteId,
    searchParams,
    dealIdParam,
    quoteIdParam,
    customerIdParam,
    publishAction,
    editingQuote,
    referencedCustomer,
    selectedDealId,
    setSelectedDealId,
    referencedDeal,
    quoteSourceInitializationKey,
    initializedQuoteSourceRef,
    autoPublishActionRef,
    saveHandlerRef,
    isDealLocked,
    newQuoteIdentity,
    quoteNumber,
    quoteTitle,
    setQuoteTitle,
    quoteLines,
    setQuoteLines,
    adjustments,
    setAdjustments,
    taxPercent,
    setTaxPercent,
    discountAmount,
    setDiscountAmount,
    quoteNotes,
    setQuoteNotes,
    recipientEmail,
    setRecipientEmail,
    paymentTiming,
    setPaymentTiming,
    paymentDueDays,
    setPaymentDueDays,
    paymentMethod,
    setPaymentMethod,
    paymentAgreementLines,
    setPaymentAgreementLines,
    exportBusy,
    setExportBusy,
    sendBusy,
    setSendBusy,
    deliveryConfirmation,
    setDeliveryConfirmation,
    validUntil,
    setValidUntil,
    isProductPickerOpen,
    setIsProductPickerOpen,
    toastMessage,
    setToastMessage,
    toastType,
    setToastType,
    validationError,
    setValidationError,
    titleError,
    setTitleError,
    saveBusy,
    setSaveBusy,
    titleInputRef,
    firstLineActionRef,
    savedDraftFingerprint,
    setSavedDraftFingerprint,
    draftHydrated,
    setDraftHydrated,
    validationSummaryRef,
    triggerToast,
    isClosedDeal,
    getDealStageLabel,
    handleUpdateLineField,
    handleAddLineItem,
    handleRemoveLineItem,
    pricedQuoteLines,
    rawSubtotal,
    computedDiscounts,
    computedFees,
    computedTaxes,
    quoteGrandTotal,
    pricedAdjustments,
    paymentAgreement,
    paymentAgreementPercent,
    currentDraftFingerprint,
    hasUnsavedChanges,
    approvalPolicy,
    approvalAssessment,
    approvalIsCurrent,
    approvalPending,
    mustRequestApproval,
    validateCurrentDraft,
    buildCurrentQuote,
    appendDealActivity,
    navigateAfterSave,
    persistCurrentQuote,
    handleSaveQuote,
    getPdfSourceElement,
    createCurrentQuotePdf,
    handleExportPdf,
    handleRequestApproval,
    handleSendGmail,
    handleOpenDeliveryConfirmation,
    confirmQuoteSent,
  } = controller;

  // Render safe not-found state if quoteId param was passed but quote wasn't found
  if (quoteIdParam && !editingQuote) {
    return (
      <div id="quote-builder-not-found" className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-center space-y-4">
        <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-full">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">{t("quoteBuilder.errors.quoteNotFoundTitle")}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {t("quoteBuilder.errors.quoteNotFoundDescription")}
        </p>
        {dealIdParam ? (
          <button
            onClick={() => navigate(`/deals/${dealIdParam}`)}
            className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
          >
            {t("quoteBuilder.actions.backToDeal")}
          </button>
        ) : (
          <button
            onClick={() => navigate("/deals")}
            className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
          >
            {t("quoteBuilder.actions.backToDeals")}
          </button>
        )}
      </div>
    );
  }

  // SENT and terminal versions are immutable; editing creates a revision.
  if (editingQuote && isQuoteVersionImmutable(editingQuote.status)) {
    return (
      <div id="quote-builder-not-draft-blocked" className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-center space-y-4">
        <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-full">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{t("quoteBuilder.errors.notDraftTitle")}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {t("quoteBuilder.errors.notDraftDescription")}
        </p>
        <button
          onClick={() => {
            if (editingQuote.dealId) {
              navigate(`/deals/${editingQuote.dealId}`);
            } else if (editingQuote.customerId) {
              navigate(`/customers/${editingQuote.customerId}`);
            } else {
              navigate("/quotes");
            }
          }}
          className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
        >
          {editingQuote.dealId ? t("quoteBuilder.actions.backToDeal") : (locale === "vi" ? "Trở lại" : "Back")}
        </button>

        <button
          onClick={async () => {
            const revision = (await createQuoteRevisionCommand(editingQuote.id)).data;
            navigate(`/quotes/${revision.id}/edit`);
          }}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-bold text-xs shadow-md transition-colors cursor-pointer"
        >
          {locale === "vi" ? `Tạo bản sửa đổi v${editingQuote.version + 1}` : `Create revision v${editingQuote.version + 1}`}
        </button>

        {editingQuote.status === QuoteStatus.ACCEPTED && getQuoteConversionIssues(editingQuote).length === 0 && (
          <button
            onClick={() => navigate(`/orders/new?quoteId=${editingQuote.id}`)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShoppingBag size={14} />
            <span>{locale === "vi" ? "Tạo đơn hàng từ báo giá này" : "Create Order from this Quote"}</span>
          </button>
        )}
      </div>
    );
  }

  // Render blocked state if referenced deal is closed
  if (isClosedDeal && referencedDeal) {
    return (
      <div id="quote-builder-blocked" className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-center space-y-4">
        <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-full">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{t("quoteBuilder.closedDealBlocked.title")}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {t("quoteBuilder.closedDealBlocked.description")}
        </p>
        <button
          onClick={() => navigate(`/deals/${referencedDeal.id}`)}
          className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 rounded-lg font-bold text-xs shadow transition-colors cursor-pointer"
        >
          {t("quoteBuilder.closedDealBlocked.backToDeal")}
        </button>
      </div>
    );
  }

  return (
    <div id="quote-builder-page" className="crm-form-page !max-w-7xl space-y-5 text-xs">
      
      {/* Toast Alert Mock */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg transition-transform animate-bounce ${
          toastType === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : toastType === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-slate-100 border-slate-200 text-slate-800"
        }`}>
          <CheckCircle2 size={16} />
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}

      <PageHeader
        id="quote-builder-header"
        title={t("quoteBuilder.titleWithDocument", { document: getQuoteDocumentLabel(crmConfig, t) })}
        icon={<FileText size={18} />}
        className="mb-0"
        actions={
          <div className="flex items-center gap-2">
            <OperationGuideButton
              guide={operationGuide}
              label={locale === "vi" ? "Hướng dẫn" : "Guide"}
              closeLabel={locale === "vi" ? "Đã hiểu" : "Got it"}
            />
            <Button
              id="back-to-deal-header-btn"
              variant="secondary"
              size="sm"
              className="h-9 whitespace-nowrap rounded-xl"
              onClick={() => {
                if (referencedDeal) {
                  navigate(`/deals/${referencedDeal.id}`);
                } else if (editingQuote?.customerId || customerIdParam) {
                  navigate(`/customers/${editingQuote?.customerId || customerIdParam}`);
                } else {
                  navigate("/quotes");
                }
              }}
              icon={<ArrowLeft size={13} />}
            >
              {referencedDeal ? t("quoteBuilder.actions.backToDeal") : (locale === "vi" ? "Quay lại" : "Back")}
            </Button>
          </div>
        }
      />

      {validationError && (
        <p ref={validationSummaryRef} tabIndex={-1} id="quote-validation-summary" role="alert" aria-live="polite" className="text-sm text-rose-700">
          {validationError}
        </p>
      )}

      {/* TWO COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 gap-5 items-start xl:grid-cols-12">
        
        {/* FULL-WIDTH EDIT CONTROLS; document preview opens in a modal. */}
        <div className="space-y-4 xl:col-span-12">
          
          {/* Linked Deal or Direct Customer card */}
          {referencedDeal ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
              <h2 className="font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <Landmark size={14} className="text-slate-500" />
                <span>{t("quoteBuilder.linkedDeal.title")}</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-1 font-medium">
                <div>
                  <span className="text-slate-600 block text-xs font-bold uppercase">{t("quoteBuilder.linkedDeal.deal")}</span>
                  <span className="font-bold text-slate-800 block crm-text-wrap">{referencedDeal.name}</span>
                </div>
                <div>
                  <span className="text-slate-600 block text-xs font-bold uppercase">{t("quoteBuilder.linkedDeal.customer")}</span>
                  <span className="font-bold text-slate-700 block crm-text-wrap">{referencedDeal.customerName || referencedDeal.organizationAccountName || referencedDeal.contactName || referencedDeal.buyerRef.id}</span>
                </div>
                <div>
                  <span className="text-slate-600 block text-xs font-bold uppercase">{t("quoteBuilder.linkedDeal.amount")}</span>
                  <span className="font-semibold text-indigo-700 block">
                    {formatCurrency(referencedDeal.amount, referencedDeal.currency || currency, locale)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-xs font-bold uppercase">{t("quoteBuilder.linkedDeal.stage")}</span>
                  <span className="text-indigo-600 font-bold block">
                    {getDealStageLabel(referencedDeal.stage as DealStage)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-xs font-bold uppercase">{t("quoteBuilder.linkedDeal.owner")}</span>
                  <span className="text-slate-700 block crm-text-wrap">
                    {referencedDeal.ownerId === "unassigned" ? t("common.notAvailable") : resolveWorkspaceMemberLabel(referencedDeal.ownerId, locale)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm">
              <h2 className="font-semibold text-indigo-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <FileText size={14} className="text-indigo-500" />
                <span>{locale === "vi" ? "Thông tin báo giá trực tiếp" : "Direct Customer Quotation Info"}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-1 font-medium text-xs text-slate-700">
                <div>
                  <span className="text-slate-600 block text-xs font-bold uppercase">{locale === "vi" ? "Khách hàng" : "Customer"}</span>
                  <span className="font-semibold text-slate-900 block crm-text-wrap">
                    {referencedCustomer?.name || editingQuote?.customerName || (locale === "vi" ? "Khách hàng trực tiếp" : "Direct Customer")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-xs font-bold uppercase">{locale === "vi" ? "Liên hệ" : "Contact Phone"}</span>
                  <span className="font-bold block text-slate-800">
                    {referencedCustomer?.phone || editingQuote?.customerContact || (locale === "vi" ? "Chưa gán" : "Not Assigned")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-xs font-bold uppercase">Email</span>
                  <span className="font-bold block text-slate-800 crm-text-wrap">
                    {referencedCustomer?.email || (locale === "vi" ? "Chưa gán" : "Not Assigned")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quote info Card */}
          <EffectiveFieldAccessScope fieldKey="title">
          <section className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm">
            <SectionHeader title={t("quoteBuilder.sections.quoteInfo")} icon={<FileText size={14} />} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="sm:col-span-2">
                <Input
                  id="quote-title"
                  ref={titleInputRef}
                  label={`${t("quoteBuilder.fields.quoteTitle")} *`}
                  required
                  error={titleError}
                  aria-describedby={validationError ? "quote-validation-summary" : undefined}
                  value={quoteTitle}
                  onChange={(e) => setQuoteTitle(e.target.value)}
                  placeholder={t("quoteBuilder.placeholders.quoteTitle")}
                />
              </div>

              <div>
                <Input
                  label={t("deals.quotes.quoteNumber")}
                  value={quoteNumber}
                  readOnly
                  className="font-mono bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed focus:ring-0"
                />
              </div>

              <div>
                <Select
                  label={locale === "vi" ? "Tiền tệ" : "Currency"}
                  value={currency}
                  disabled={Boolean(referencedDeal)}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {workspaceConfiguration.localeRegion.currencies.enabledCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
                </Select>
                {referencedDeal ? <span className="mt-1 block text-xs text-slate-500">{locale === "vi" ? "Kế thừa từ cơ hội." : "Inherited from the opportunity."}</span> : null}
              </div>

              <div className="space-y-1.5 flex flex-col justify-start">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">{t("deals.quotes.status")}</span>
                <div className="pt-2">
                  <Badge variant={getQuoteStatusBadgeVariant("DRAFT")}>
                    {t("quote.status.draft")}
                  </Badge>
                </div>
              </div>

              <div>
                <SearchableSelect
                  label={t("quoteBuilder.fields.linkedDealSelector")}
                  id="referenced-deal-selector"
                  value={selectedDealId}
                  disabled={isDealLocked}
                  onChange={setSelectedDealId}
                  placeholder={locale === "vi" ? "Chọn cơ hội" : "Select opportunity"}
                  searchPlaceholder={locale === "vi" ? "Tìm theo tên cơ hội hoặc khách hàng..." : "Search opportunity or customer..."}
                  clearable={!isDealLocked}
                  options={isDealLocked && referencedDeal
                    ? [{ value: referencedDeal.id, label: referencedDeal.name, description: referencedDeal.customerName || referencedDeal.organizationAccountName || referencedDeal.contactName }]
                    : deals.map((deal) => ({ value: deal.id, label: deal.name, description: deal.customerName || deal.organizationAccountName || deal.contactName || deal.stage || deal.id, keywords: `${deal.customerName || ""} ${deal.organizationAccountName || ""} ${deal.contactName || ""} ${deal.stage || ""}` }))}
                />
                <span className="text-xs text-slate-600 font-medium block mt-1">
                  {isDealLocked 
                    ? t("quoteBuilder.fields.dealLockedHelp")
                    : t("quoteBuilder.fields.dealUnlockedHelp")}
                </span>
              </div>

              <div>
                <Input
                  label={t("deals.quotes.validUntil")}
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="font-mono font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  label={locale === "vi" ? "Email nhận Báo giá *" : "Quote recipient email *"}
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  placeholder="customer@company.com"
                />
                <span className="mt-1 block text-xs font-medium text-slate-600">
                  {locale === "vi" ? "Email này được dùng khi mở Gmail và phát hành Báo giá." : "Used when launching Gmail and issuing the Quote."}
                </span>
              </div>

            </div>
          </section>
          </EffectiveFieldAccessScope>

          {/* Product lines and pricing */}
          <EffectiveFieldAccessScope fieldKey="items">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              title={t("quotes.adjustLinesStep")}
              icon={<ShoppingBag size={14} />}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <span ref={firstLineActionRef} tabIndex={-1}>
                  <Button
                    type="button"
                    actionIntent="create"
                    size="xs"
                    className="h-8 whitespace-nowrap rounded-xl"
                    icon={<PlusCircle size={12} />}
                    onClick={() => setIsProductPickerOpen(true)}
                  >
                    {locale === "vi" ? "Chọn từ danh mục" : "Select from catalog"}
                  </Button>
                  </span>
                  <Button
                    type="button"
                    actionIntent="create"
                    size="xs"
                    className="h-8 whitespace-nowrap rounded-xl"
                    icon={<PlusCircle size={12} />}
                    onClick={handleAddLineItem}
                  >
                    {t("quoteBuilder.actions.addProduct")}
                  </Button>
                </div>
              }
            />

            {/* Desktop Table View (hidden on mobile, visible on medium screens and up) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-slate-100 bg-transparent">
                  <TableRow>
                    <TableCell className="w-[40%] font-bold text-xs text-slate-500 uppercase tracking-wider px-2 py-3 border-none">{t("quotes.colProduct")}</TableCell>
                    <TableCell className="w-[12%] text-center font-bold text-xs text-slate-500 uppercase tracking-wider px-2 py-3 border-none">{t("quotes.colQuantity")}</TableCell>
                    <TableCell className="w-[22%] font-bold text-xs text-slate-500 uppercase tracking-wider px-2 py-3 border-none">{t("quotes.colUnitPrice")}</TableCell>
                    <TableCell className="w-[16%] text-center font-bold text-xs text-slate-500 uppercase tracking-wider px-2 py-3 border-none">{t("quotes.colDiscount")} (%)</TableCell>
                    <TableCell className="w-[10%] text-right font-bold text-xs text-slate-500 uppercase tracking-wider px-2 py-3 border-none">{t("quotes.colSubtotal")}</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quoteLines.map((item, index) => {
                    const lineDiscounted = (item.unitPrice ?? 0) * (1 - (item.discountPercent || 0) / 100);
                    const lineSub = lineDiscounted * (item.quantity || 0);

                    return (
                      <TableRow key={item.id} className="border-b border-slate-100">
                        <TableCell className="space-y-1 text-left py-3 px-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(item.id)}
                              className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
                              title={t("quoteBuilder.actions.removeRow")}
                              aria-label={`${t("quoteBuilder.actions.removeRow")}: ${item.productName || index + 1}`}
                            >
                              <Trash2 size={13} />
                            </button>
                            <input 
                              type="text"
                              value={item.productName}
                              aria-label={`${t("quotes.colProduct")} ${index + 1}`}
                              aria-invalid={!item.productName?.trim()}
                              aria-describedby={!item.productName?.trim() && validationError ? "quote-validation-summary" : undefined}
                              data-quote-line-invalid={!item.productName?.trim() ? "true" : undefined}
                              onChange={(e) => handleUpdateLineField(item.id, "productName", e.target.value)}
                              placeholder={t("quoteBuilder.placeholders.productName")}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none"
                            />
                          </div>
                          <input 
                            type="text"
                            value={item.description || ""}
                            aria-label={`${t("quoteBuilder.placeholders.description")} ${index + 1}`}
                            onChange={(e) => handleUpdateLineField(item.id, "description", e.target.value)}
                            placeholder={t("quoteBuilder.placeholders.description")}
                            className="w-full pl-5 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-violet-500 focus:bg-white rounded px-2.5 py-1 text-xs text-slate-500 font-semibold focus:outline-none focus:ring-0"
                          />
                        </TableCell>
                        <TableCell className="text-center py-3 px-2">
                          <input 
                            type="number"
                            min="1"
                            value={item.quantity || ""}
                            aria-label={`${t("quotes.colQuantity")} ${index + 1}`}
                            aria-invalid={item.quantity <= 0}
                            aria-describedby={item.quantity <= 0 && validationError ? "quote-validation-summary" : undefined}
                            data-quote-line-invalid={item.quantity <= 0 ? "true" : undefined}
                            onChange={(e) => handleUpdateLineField(item.id, "quantity", Math.max(1, Number(e.target.value)))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-center font-bold text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none"
                          />
                        </TableCell>
                        <TableCell className="py-3 px-2">
                          <div className="relative">
                            <input 
                              type="number"
                              min="0"
                              step="50000"
                              value={item.unitPrice || ""}
                              aria-label={`${t("quotes.colUnitPrice")} ${index + 1}`}
                              aria-invalid={(item.unitPrice ?? 0) < 0}
                              aria-describedby={(item.unitPrice ?? 0) < 0 && validationError ? "quote-validation-summary" : undefined}
                              data-quote-line-invalid={(item.unitPrice ?? 0) < 0 ? "true" : undefined}
                              onChange={(e) => handleUpdateLineField(item.id, "unitPrice", Math.max(0, Number(e.target.value)))}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-right font-mono font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none pr-1.5"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-3 px-2">
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={item.discountPercent || ""}
                            aria-label={`${t("quotes.colDiscount")} ${index + 1}`}
                            aria-invalid={(item.discountPercent ?? 0) < 0 || (item.discountPercent ?? 0) > 100}
                            aria-describedby={((item.discountPercent ?? 0) < 0 || (item.discountPercent ?? 0) > 100) && validationError ? "quote-validation-summary" : undefined}
                            data-quote-line-invalid={(item.discountPercent ?? 0) < 0 || (item.discountPercent ?? 0) > 100 ? "true" : undefined}
                            onChange={(e) => handleUpdateLineField(item.id, "discountPercent", Math.min(100, Math.max(0, Number(e.target.value))))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-center font-bold text-xs text-indigo-700 focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none"
                          />
                        </TableCell>
                        <TableCell className="text-right text-slate-900 font-mono font-semibold text-xs py-3 px-2 border-none">
                          {formatCurrency(lineSub, currency, locale)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Line Items (visible only on mobile, hidden on md and up) */}
            <div className="block md:hidden space-y-3">
              {quoteLines.map((item, index) => {
                const lineDiscounted = (item.unitPrice ?? 0) * (1 - (item.discountPercent || 0) / 100);
                const lineSub = lineDiscounted * (item.quantity || 0);

                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs relative space-y-3 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <input 
                          type="text"
                          value={item.productName}
                          aria-label={`${t("quotes.colProduct")} ${index + 1}`}
                          onChange={(e) => handleUpdateLineField(item.id, "productName", e.target.value)}
                          placeholder={t("quoteBuilder.placeholders.productName")}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(item.id)}
                        className="text-slate-600 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
                        title={t("quoteBuilder.actions.removeRow")}
                        aria-label={`${t("quoteBuilder.actions.removeRow")}: ${item.productName || index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div>
                      <input 
                        type="text"
                        value={item.description || ""}
                        aria-label={`${t("quoteBuilder.placeholders.description")} ${index + 1}`}
                        onChange={(e) => handleUpdateLineField(item.id, "description", e.target.value)}
                        placeholder={t("quoteBuilder.placeholders.description")}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-violet-500 focus:bg-white rounded-lg px-2.5 py-1.5 text-xs text-slate-500 font-semibold focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          {t("quotes.colQuantity")}
                        </label>
                        <input 
                          type="number"
                          min="1"
                          value={item.quantity || ""}
                          aria-label={`${t("quotes.colQuantity")} ${index + 1}`}
                          onChange={(e) => handleUpdateLineField(item.id, "quantity", Math.max(1, Number(e.target.value)))}
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-xs text-slate-800 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          {t("quotes.colUnitPrice")}
                        </label>
                        <input 
                          type="number"
                          min="0"
                          step="50000"
                          value={item.unitPrice || ""}
                          aria-label={`${t("quotes.colUnitPrice")} ${index + 1}`}
                          onChange={(e) => handleUpdateLineField(item.id, "unitPrice", Math.max(0, Number(e.target.value)))}
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg text-right px-3 font-mono font-bold text-xs text-slate-800 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-dashed border-slate-100">
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          {t("quotes.colDiscount")} (%)
                        </label>
                        <input 
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={item.discountPercent || ""}
                          aria-label={`${t("quotes.colDiscount")} ${index + 1}`}
                          onChange={(e) => handleUpdateLineField(item.id, "discountPercent", Math.min(100, Math.max(0, Number(e.target.value))))}
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-xs text-indigo-700 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                        />
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          {t("quotes.colSubtotal")}
                        </span>
                        <span className="font-mono font-semibold text-xs text-slate-900 block pt-1.5">
                          {formatCurrency(lineSub, currency, locale)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* General adjustments form - fully rebuilt for robust pricing */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Percent size={13} className="text-violet-600" />
                  <span>{locale === "vi" ? "Chiết khấu, phụ phí và thuế" : "Discounts, fees and taxes"}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const newAdj: SalesDocumentAdjustment = {
                      id: createDurableId("adj"),
                      label: "Chiết khấu / Phí mới",
                      type: SalesDocumentAdjustmentType.DISCOUNT,
                      calculation: "PERCENTAGE" as const,
                      value: 5,
                      amount: 0
                    };
                    setAdjustments([...adjustments, newAdj]);
                  }}
                  className="text-xs bg-violet-600 hover:bg-violet-700 text-white font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition-all shadow-xs"
                >
                  {locale === "vi" ? "+ Thêm điều chỉnh" : "+ Add adjustment"}
                </button>
              </div>

              {adjustments.length === 0 ? (
                <p className="text-xs text-slate-600 italic text-left">{locale === "vi" ? "Chưa có điều chỉnh giá." : "No pricing adjustments."}</p>
              ) : (
                <div className="space-y-2">
                  {adjustments.map((adj) => (
                    <div key={adj.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11.5px] font-semibold">
                      <div className="col-span-12 sm:col-span-4">
                        <input
                          type="text"
                          aria-label={locale === "vi" ? `Tên điều chỉnh ${adj.label}` : `Adjustment name ${adj.label}`}
                          value={adj.label}
                          placeholder={locale === "vi" ? "Tên điều chỉnh" : "Adjustment name"}
                          onChange={(e) => {
                            setAdjustments(prev => prev.map(a => a.id === adj.id ? { ...a, label: e.target.value } : a));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-3">
                        <select
                          aria-label={locale === "vi" ? `Loại điều chỉnh ${adj.label}` : `Adjustment type ${adj.label}`}
                          value={adj.type}
                          onChange={(e) => {
                            setAdjustments(prev => prev.map(a => a.id === adj.id ? { ...a, type: e.target.value as any } : a));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10.5px] font-bold focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer text-slate-700"
                        >
                          <option value={SalesDocumentAdjustmentType.DISCOUNT}>{locale === "vi" ? "Chiết khấu" : "Discount"}</option>
                          <option value={SalesDocumentAdjustmentType.SERVICE_FEE}>{locale === "vi" ? "Phí dịch vụ" : "Service fee"}</option>
                          <option value={SalesDocumentAdjustmentType.TAX}>{locale === "vi" ? "Thuế" : "Tax"}</option>
                        </select>
                      </div>

                      <div className="col-span-4 sm:col-span-2">
                        <select
                          aria-label={locale === "vi" ? `Cách tính ${adj.label}` : `Calculation method ${adj.label}`}
                          value={adj.calculation}
                          onChange={(e) => {
                            setAdjustments(prev => prev.map(a => a.id === adj.id ? { ...a, calculation: e.target.value as any } : a));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 text-[10.5px] font-bold focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer text-slate-700"
                        >
                          <option value="PERCENTAGE">{locale === "vi" ? "Tỷ lệ (%)" : "Percentage (%)"}</option>
                          <option value="FIXED_AMOUNT">{locale === "vi" ? "Số tiền" : "Fixed amount"}</option>
                        </select>
                      </div>

                      <div className="col-span-3 sm:col-span-2">
                        <input
                          type="number"
                          aria-label={locale === "vi" ? `Giá trị ${adj.label}` : `Value ${adj.label}`}
                          min="0"
                          value={adj.value}
                          onChange={(e) => {
                            setAdjustments(prev => prev.map(a => a.id === adj.id ? { ...a, value: Math.max(0, Number(e.target.value)) } : a));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-right font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>

                      <div className="col-span-1 text-center font-normal">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustments(prev => prev.filter(a => a.id !== adj.id));
                          }}
                          aria-label={locale === "vi" ? `Xóa điều chỉnh ${adj.label}` : `Remove adjustment ${adj.label}`}
                          className="text-slate-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          </EffectiveFieldAccessScope>

          {/* Commercial terms */}
          <EffectiveFieldAccessScope fieldKey="paymentAgreement">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader title={locale === "vi" ? "Điều khoản thương mại & thanh toán" : "Commercial and payment terms"} />
            <div className="grid gap-4 md:grid-cols-3">
              <Select
                label={locale === "vi" ? "Thời điểm thanh toán" : "Payment timing"}
                value={paymentTiming}
                onChange={(event) => setPaymentTiming(event.target.value as QuotePaymentTiming)}
              >
                <option value="PREPAID">Trả trước</option>
                <option value="ON_DELIVERY">Thanh toán khi giao</option>
                <option value="POSTPAID">Trả sau</option>
                <option value="CUSTOM">Tùy chỉnh</option>
              </Select>
              <Select
                label={locale === "vi" ? "Phương thức" : "Payment method"}
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as QuotePaymentMethod)}
              >
                {paymentMethods.map((method) => (
                  <option key={method.code} value={method.kind}>{locale === "vi" ? method.displayNameVi : method.displayNameEn}</option>
                ))}
              </Select>
              <Input
                label={locale === "vi" ? "Số ngày trả sau" : "Postpaid days"}
                type="number"
                min={0}
                value={paymentTiming === "POSTPAID" ? paymentDueDays : 0}
                disabled={paymentTiming !== "POSTPAID"}
                onChange={(event) => setPaymentDueDays(Math.max(0, Number(event.target.value)))}
              />
              <div className="md:col-span-3 rounded-xl border border-violet-200 bg-violet-50/40 p-4" data-payment-agreement-builder="v1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{locale === "vi" ? "Thỏa thuận thanh toán nhiều đợt" : "Multi-line Payment Agreement"}</div>
                    <div className="mt-1 text-xs text-slate-600">{locale === "vi" ? "Snapshot này được sao chép bất biến sang Order và dùng để tạo Payment Plan versioned." : "This immutable snapshot is copied to the Order and becomes a versioned Payment Plan."}</div>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setPaymentAgreementLines((current) => [
                    ...current.map((line) => line.amountMode === "REMAINDER" ? { ...line, amountMode: "PERCENTAGE" as const, percentage: 0 } : line),
                    { ...legacyAgreementDraftLine(), id: allocateAgreementLineId(), label: `Đợt ${current.length + 1}`, purpose: "INSTALLMENT", amountMode: "REMAINDER" },
                  ])}>
                    <Plus size={14} /> {locale === "vi" ? "Thêm đợt" : "Add line"}
                  </Button>
                </div>
                <div className="mt-4 space-y-3">
                  {paymentAgreementLines.map((line, index) => {
                    const preview = paymentAgreement.lines[index]?.previewAmount;
                    return (
                      <div key={line.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-12">
                        <div className="md:col-span-3"><Input label={locale === "vi" ? "Tên đợt" : "Line label"} value={line.label} onChange={(event) => setPaymentAgreementLines((current) => current.map((item) => item.id === line.id ? { ...item, label: event.target.value } : item))} /></div>
                        <div className="md:col-span-2"><Select label={locale === "vi" ? "Mục đích" : "Purpose"} value={line.purpose} onChange={(event) => setPaymentAgreementLines((current) => current.map((item) => item.id === line.id ? { ...item, purpose: event.target.value as PaymentPurpose } : item))}><option value="FULL">{locale === "vi" ? "Toàn bộ" : "Full payment"}</option><option value="DEPOSIT">{locale === "vi" ? "Đặt cọc" : "Deposit"}</option><option value="BALANCE">{locale === "vi" ? "Phần còn lại" : "Balance"}</option><option value="INSTALLMENT">{locale === "vi" ? "Trả góp" : "Installment"}</option><option value="MILESTONE">{locale === "vi" ? "Cột mốc" : "Milestone"}</option><option value="OTHER">{locale === "vi" ? "Khác" : "Other"}</option></Select></div>
                        <div className="md:col-span-2"><Select label={locale === "vi" ? "Cách tính" : "Amount rule"} value={line.amountMode} onChange={(event) => setPaymentAgreementLines((current) => current.map((item, itemIndex) => item.id === line.id ? { ...item, amountMode: event.target.value as "PERCENTAGE" | "REMAINDER", percentage: event.target.value === "REMAINDER" ? 0 : item.percentage } : item))}><option value="PERCENTAGE">{locale === "vi" ? "Tỷ lệ %" : "Percentage"}</option><option value="REMAINDER">{locale === "vi" ? "Phần còn lại" : "Remainder"}</option></Select></div>
                        <div className="md:col-span-1"><Input label="%" type="number" min={0} max={100} disabled={line.amountMode === "REMAINDER"} value={line.amountMode === "REMAINDER" ? 0 : line.percentage} onChange={(event) => setPaymentAgreementLines((current) => current.map((item) => item.id === line.id ? { ...item, percentage: Math.max(0, Number(event.target.value)) } : item))} /></div>
                        <div className="md:col-span-2"><Select label={locale === "vi" ? "Phương thức" : "Method"} value={line.methodCode} onChange={(event) => setPaymentAgreementLines((current) => current.map((item) => item.id === line.id ? { ...item, methodCode: event.target.value, fulfillmentGate: isCanonicalCodMethodCode(event.target.value) ? "NONE" : item.fulfillmentGate } : item))}>{paymentMethods.map((method) => <option key={method.code} value={method.code}>{locale === "vi" ? method.displayNameVi : method.displayNameEn}</option>)}</Select></div>
                        <div className="md:col-span-2 flex items-end justify-between gap-2"><div className="pb-2 text-xs font-semibold text-slate-700">{preview ? formatMoneyDto(preview, locale === "vi" ? "vi-VN" : "en-US") : "—"}</div><button type="button" disabled={paymentAgreementLines.length === 1} onClick={() => setPaymentAgreementLines((current) => current.filter((item) => item.id !== line.id))} className="mb-1 rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40" aria-label={locale === "vi" ? `Xóa đợt ${index + 1}` : `Remove line ${index + 1}`}><Trash2 size={15} /></button></div>
                        <div className="md:col-span-3"><Select label={locale === "vi" ? "Thời điểm" : "Timing"} value={line.timing} onChange={(event) => setPaymentAgreementLines((current) => current.map((item) => item.id === line.id ? { ...item, timing: event.target.value as QuotePaymentTiming } : item))}><option value="PREPAID">{locale === "vi" ? "Khi xác nhận Order" : "When Order is confirmed"}</option><option value="ON_DELIVERY">{locale === "vi" ? "Khi giao hàng" : "On delivery"}</option><option value="POSTPAID">{locale === "vi" ? "Sau khi phát hành hóa đơn" : "After invoice issue"}</option><option value="CUSTOM">{locale === "vi" ? "Theo cột mốc" : "By milestone"}</option></Select></div>
                        <div className="md:col-span-2"><Input label={locale === "vi" ? "Số ngày" : "Offset days"} type="number" min={0} value={line.dueDays} disabled={line.timing === "PREPAID" || line.timing === "ON_DELIVERY"} onChange={(event) => setPaymentAgreementLines((current) => current.map((item) => item.id === line.id ? { ...item, dueDays: Math.max(0, Number(event.target.value)) } : item))} /></div>
                        <div className="md:col-span-3"><Select label={locale === "vi" ? "Điểm chặn vận hành" : "Fulfillment gate"} value={line.fulfillmentGate} disabled={isCanonicalCodMethodCode(line.methodCode)} onChange={(event) => setPaymentAgreementLines((current) => current.map((item) => item.id === line.id ? { ...item, fulfillmentGate: event.target.value as PaymentFulfillmentGate } : item))}><option value="NONE">{locale === "vi" ? "Không chặn" : "No gate"}</option><option value="BEFORE_BOOKING">{locale === "vi" ? "Trước đặt vận đơn" : "Before booking"}</option><option value="BEFORE_DISPATCH">{locale === "vi" ? "Trước xuất hàng" : "Before dispatch"}</option><option value="BEFORE_COMPLETION">{locale === "vi" ? "Trước hoàn tất Order" : "Before Order completion"}</option></Select></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="md:col-span-3">
                <Textarea
                  label={t("quotes.paymentTerms")}
                  rows={4}
                  value={quoteNotes}
                  onChange={(event) => setQuoteNotes(event.target.value)}
                  className="bg-slate-50 text-xs font-semibold leading-relaxed focus:bg-white"
                />
              </div>
            </div>
          </section>
          </EffectiveFieldAccessScope>

          <section
            data-quote-approval-assessment="v1"
            className={`rounded-xl border p-5 shadow-sm ${approvalIsCurrent || !approvalAssessment.required ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${approvalIsCurrent || !approvalAssessment.required ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Phê duyệt nội bộ</div>
                  <div className={`mt-1 text-base font-semibold ${approvalIsCurrent || !approvalAssessment.required ? "text-emerald-950" : "text-amber-950"}`}>
                    {approvalIsCurrent
                      ? "Đã phê duyệt - có thể gửi khách"
                      : approvalPending
                        ? "Đang chờ phê duyệt"
                        : approvalAssessment.required
                          ? "Cần phê duyệt trước khi gửi"
                          : "Không cần phê duyệt - có thể gửi thẳng"}
                  </div>
                  <div className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
                    {approvalIsCurrent
                      ? `Nội dung hiện tại khớp snapshot đã được duyệt${editingQuote?.approvedBy ? ` bởi ${editingQuote.approvedBy}` : ""}.`
                      : approvalAssessment.required
                        ? `Người duyệt theo chính sách: ${approvalAssessment.approverRoleLabel || "Người có quyền duyệt Báo giá"}.`
                        : "Giá, chiết khấu và điều khoản đang nằm trong hạn mức gửi trực tiếp."}
                  </div>
                </div>
              </div>
              <Badge variant={approvalIsCurrent || !approvalAssessment.required ? "success" : "warning"}>
                {approvalIsCurrent ? "ĐÃ DUYỆT" : approvalPending ? "ĐANG CHỜ" : approvalAssessment.required ? "CẦN DUYỆT" : "GỬI THẲNG"}
              </Badge>
            </div>
            {approvalAssessment.reasons.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-amber-200 pt-4">
                {approvalAssessment.reasons.map((reason) => (
                  <div key={reason.code} className="flex gap-2 text-xs font-semibold leading-relaxed text-amber-900">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    <span>{reason.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Shared form action surface */}
          <div data-quote-builder-actions="v1" data-mobile-action-bar="true" className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => {
                if (referencedDeal) navigate(`/deals/${referencedDeal.id}`);
                else if (editingQuote?.customerId || customerIdParam) navigate(`/customers/${editingQuote?.customerId || customerIdParam}`);
                else navigate("/deals");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="info"
              size="sm"
              className="h-9 rounded-xl"
              onClick={handleExportPdf}
              icon={<Download size={13} />}
              disabled={exportBusy || sendBusy}
            >
              {exportBusy ? "Đang tạo PDF..." : "Xuất PDF"}
            </Button>
            {mustRequestApproval ? (
              <Button
                type="button"
                variant="warning"
                size="sm"
                className="h-9 rounded-xl"
                onClick={handleRequestApproval}
                icon={<ShieldCheck size={13} />}
                disabled={approvalPending}
              >
                {approvalPending ? "Đang chờ duyệt" : "Gửi duyệt"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="success"
                  size="sm"
                  className="h-9 rounded-xl"
                  onClick={handleOpenDeliveryConfirmation}
                  icon={<MessageCircle size={13} />}
                  disabled={sendBusy || exportBusy}
                  data-guidance-id="quotes.delivery.open-confirmation"
                >
                  {locale === "vi" ? "Xác nhận đã gửi" : "Confirm sent"}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="h-9 rounded-xl"
                  onClick={handleSendGmail}
                  icon={<Mail size={13} />}
                  disabled={sendBusy || exportBusy}
                  data-guidance-id="quotes.delivery.gmail"
                >
                  {sendBusy ? (locale === "vi" ? "Đang chuẩn bị..." : "Preparing...") : (locale === "vi" ? "Gửi qua Gmail" : "Send with Gmail")}
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="h-9 rounded-xl"
              onClick={handleSaveQuote}
              icon={<Save size={13} />}
              disabled={saveBusy || exportBusy || sendBusy}
            >
              {saveBusy ? (locale === "vi" ? "Đang lưu..." : "Saving...") : t("quoteBuilder.actions.saveDraft")}
            </Button>
          </div>

        </div>

        <div className="min-w-0 xl:col-span-12">
          <QuoteBuilderPreview
            quoteNumber={quoteNumber}
            currency={currency}
            validUntil={validUntil}
            quoteTitle={quoteTitle}
            referencedDeal={referencedDeal}
            referencedCustomer={referencedCustomer}
            editingQuote={editingQuote}
            quoteLines={pricedQuoteLines}
            rawSubtotal={rawSubtotal}
            computedFees={computedFees}
            computedDiscounts={computedDiscounts}
            quoteGrandTotal={quoteGrandTotal}
            adjustments={pricedAdjustments}
            quoteNotes={quoteNotes}
            onExportPdf={handleExportPdf}
            onSendGmail={handleSendGmail}
            onConfirmSent={handleOpenDeliveryConfirmation}
            exportBusy={exportBusy}
            sendBusy={sendBusy}
          />
        </div>

      </div>

      <QuoteDeliveryConfirmationModal
        isOpen={Boolean(deliveryConfirmation)}
        quoteNumber={quoteNumber}
        locale={locale}
        initialChannel={deliveryConfirmation?.channel}
        initialRecipientEmail={deliveryConfirmation?.recipientEmail}
        initialRecipient={deliveryConfirmation?.recipient}
        initialFileName={deliveryConfirmation?.fileName}
        channelLocked={deliveryConfirmation?.channelLocked}
        onClose={() => setDeliveryConfirmation(null)}
        onConfirm={confirmQuoteSent}
      />

      <QuoteBuilderProductPicker
        isOpen={isProductPickerOpen}
        onClose={() => setIsProductPickerOpen(false)}
        products={products}
        quoteLines={quoteLines}
        currency={currency}
        onChangeLines={setQuoteLines}
        onToast={triggerToast}
      />

    </div>
  );
}
