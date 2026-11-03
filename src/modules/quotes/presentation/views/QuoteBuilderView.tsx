import { clearConnectedWorkspaceOperationalConfigurationProjection } from "@/platform/workspace-config";
import { QuoteBuyerSelector } from "../components/QuoteBuyerSelector";
import { QuoteDealProductSuggestions } from "../components/QuoteDealProductSuggestions";
import { QuoteDraftReview } from "../components/QuoteDraftReview";
import { QuoteBuyerField } from "../components/QuoteBuyerField";
import { focusFirstQuoteBuilderIssue, quoteBuilderIssues } from "../model/quoteBuilderErrors";
import { AuthoritativeQueryBoundary } from "@/shared/operations";
import React, { useEffect } from "react";

import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, Landmark, Mail, MessageCircle, Percent, Plus, PlusCircle, Save, ShoppingBag, Trash2 } from "lucide-react";


import { getQuoteDocumentLabel, useWorkspaceCurrencyChoices } from "@/platform/workspace-config";

import { DealStage } from "@/modules/deals";

import { QuoteStatus, SalesDocumentAdjustmentType, type QuotePaymentMethod, type QuotePaymentTiming, type SalesDocumentAdjustment } from "../../domain/model/quote.types";

import { getQuoteConversionIssues } from "../../domain/rules/quoteConversion";

import { isQuoteVersionImmutable } from "../../domain/rules/quoteVersioning";
import { createQuoteRevisionCommand } from "../../public/quotes";





import { formatCurrency } from "@/shared/lib/format/currency";
import { Input, SearchableSelect, Select, Textarea, Button, Badge, PageHeader, SectionHeader, getQuoteStatusBadgeVariant, Table, TableHeader, TableBody, TableRow, TableCell } from "@/shared/components/ui";


import { QuoteBuilderPreview } from "../components/QuoteBuilderPreview";
import { QuoteBuilderProductPicker } from "../components/QuoteBuilderProductPicker";
import { QuoteDeliveryConfirmationModal } from "../components/QuoteDeliveryConfirmationModal";



import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";


import { formatMoneyDto } from "@/shared/money";
import { createDurableId } from "@/shared/ids";
import { OperationGuideButton } from "@/components/crm/OperationGuide";
import { EffectiveFieldAccessScope } from "@/platform/access-control";
import { isCanonicalCodMethodCode, type PaymentFulfillmentGate, type PaymentPurpose } from "@/shared/order-to-cash";
import type { useQuoteBuilderController } from "../hooks/useQuoteBuilderController";

type QuoteBuilderViewController = ReturnType<typeof useQuoteBuilderController>;

export function QuoteBuilderView({ controller }: { controller: QuoteBuilderViewController }) {
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const workspaceCurrencies = useWorkspaceCurrencyChoices();
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
    saveBusy,
    setSaveBusy,
    titleInputRef,
    firstLineActionRef,
    savedDraftFingerprint,
    setSavedDraftFingerprint,
    draftHydrated,
    setDraftHydrated,
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
    validateCurrentDraft,
    buildCurrentQuote,
    appendDealActivity,
    navigateAfterSave,
    persistCurrentQuote,
    handleSaveQuote,
    getPdfSourceElement,
    createCurrentQuotePdf,
    handleExportPdf,
    handleSendGmail,
    handleOpenDeliveryConfirmation,
    confirmQuoteSent,
  } = controller;

  const paymentError = paymentAgreementLines.length === 0 || paymentAgreement.lines.some(line => Number(line.previewAmount.amount) < 0)
    ? (locale === "vi" ? "Thêm ít nhất một đợt thanh toán hợp lệ." : "Add at least one valid payment installment.")
    : paymentAgreementPercent > 100.000001 ? (locale === "vi" ? "Tổng tỷ lệ các đợt không được vượt 100%." : "Installment percentages cannot exceed 100%.") : undefined;
  const issues = controller.validationAttempt ? [...quoteBuilderIssues(quoteTitle, quoteLines, locale === "vi", adjustments, recipientEmail), ...(paymentError ? [{target: "quote-payment-terms", message: paymentError}] : []), ...controller.serverFieldIssues.filter(controller.fieldIssueCurrent)]
    .filter((issue, index, all) => all.findIndex(other => other.target === issue.target) === index) : [];
  const fieldError = (target: string) => issues.find(issue => issue.target === target)?.message;
  const lineFeedback = (id: string, part: string, layout: string) => ({
    id: `quote-${layout}-${id}-${part}`,
    "data-quote-error-target": `line-${id}-${part}`,
    error: fieldError(`line-${id}-${part}`),
  });
  useEffect(() => {
    if (!controller.validationAttempt) return;
    const frame = requestAnimationFrame(() => {
      if (issues[0]) focusFirstQuoteBuilderIssue(issues);
      else if (validationError) document.getElementById("quote-action-status")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [controller.validationAttempt]);

  if (controller.sourceBuyer.required && !controller.sourceBuyer.buyer) return <div className="space-y-3 p-5" role={controller.sourceBuyer.error ? "alert" : "status"}><p>{controller.sourceBuyer.error || (locale === "vi" ? "Đang xác minh người mua nguồn…" : "Verifying source buyer…")}</p>{controller.sourceBuyer.error && <Button variant="secondary" onClick={controller.sourceBuyer.retry}>{locale === "vi" ? "Thử lại" : "Retry"}</Button>}</div>;
  // Render safe not-found state if quoteId param was passed but quote wasn't found
  if (controller.connected && !controller.workspaceConfigurationResource.data) return <div className="space-y-3 p-5" role={controller.workspaceConfigurationResource.error ? "alert" : "status"}>
    <p>{controller.workspaceConfigurationResource.error ? (locale === "vi" ? "Không tải được cấu hình báo giá. Hãy thử lại." : "Quote settings could not be loaded. Please retry.") : (locale === "vi" ? "Đang tải cấu hình báo giá…" : "Loading Quote settings…")}</p>
    {controller.workspaceConfigurationResource.error && <Button variant="secondary" onClick={clearConnectedWorkspaceOperationalConfigurationProjection}>{locale === "vi" ? "Thử lại" : "Retry"}</Button>}
  </div>;
  if ((quoteIdParam && controller.detailQuery.connected && (controller.detailQuery.loading || controller.detailQuery.error)) || (selectedDealId && controller.sourceDealQuery.connected && (controller.sourceDealQuery.loading || controller.sourceDealQuery.error))) {
    return <AuthoritativeQueryBoundary query={quoteIdParam ? controller.detailQuery : controller.sourceDealQuery} hasData={false} loadingTitleVi="Đang tải dữ liệu nguồn" loadingTitleEn="Loading source record" errorTitleVi="Không thể tải dữ liệu nguồn" errorTitleEn="Source record could not be loaded"><div /></AuthoritativeQueryBoundary>;
  }
  if (selectedDealId && controller.sourceDealQuery.connected && !referencedDeal) return <p role="alert">{locale === "vi" ? "Không tìm thấy cơ hội." : "Opportunity not found."}</p>;
  if (quoteIdParam && !editingQuote) {
    return (
      <div id="quote-builder-not-found" className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-center space-y-4">
        <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-full">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-medium text-slate-800">{t("quoteBuilder.errors.quoteNotFoundTitle")}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {t("quoteBuilder.errors.quoteNotFoundDescription")}
        </p>
        {dealIdParam ? (
          <button
            onClick={() => navigate(`/deals/${dealIdParam}`)}
            className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 rounded-lg font-medium text-xs shadow transition-colors cursor-pointer"
          >
            {t("quoteBuilder.actions.backToDeal")}
          </button>
        ) : (
          <button
            onClick={() => navigate("/deals")}
            className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 rounded-lg font-medium text-xs shadow transition-colors cursor-pointer"
          >
            {t("quoteBuilder.actions.backToDeals")}
          </button>
        )}
      </div>
    );
  }

  // SENT and terminal versions are immutable; editing creates a revision.
    if (editingQuote && (editingQuote.archivedAt || isQuoteVersionImmutable(editingQuote.status))) {
    return (
      <div id="quote-builder-not-draft-blocked" className="max-w-md mx-auto my-12 p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-center space-y-4">
        <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-full">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-medium text-slate-900">{editingQuote.archivedAt ? (locale === "vi" ? "Báo giá đã lưu trữ" : "Archived Quote") : t("quoteBuilder.errors.notDraftTitle")}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {editingQuote.archivedAt ? (locale === "vi" ? "Dữ liệu và lịch sử được giữ lại để đọc theo quyền. Không chỉnh sửa chứng từ đã lưu trữ." : "Data and history remain readable with permission. Archived documents cannot be edited.") : t("quoteBuilder.errors.notDraftDescription")}
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
          className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 rounded-lg font-medium text-xs shadow transition-colors cursor-pointer"
        >
          {editingQuote.dealId ? t("quoteBuilder.actions.backToDeal") : (locale === "vi" ? "Trở lại" : "Back")}
        </button>

        {controller.connected ? <Button variant="secondary" onClick={() => navigate(`/quotes/${editingQuote.id}`)}>{locale === "vi" ? "Mở chi tiết và lịch sử Báo giá" : "Open Quote detail and history"}</Button> : <button
          disabled={Boolean(editingQuote.archivedAt)}
          onClick={async () => {
            const revision = (await createQuoteRevisionCommand(editingQuote.id)).data;
            navigate(`/quotes/${revision.id}/edit`);
          }}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium text-xs shadow-md transition-colors cursor-pointer"
        >
          {locale === "vi" ? `Tạo bản sửa đổi v${editingQuote.version + 1}` : `Create revision v${editingQuote.version + 1}`}
        </button>}

        {!controller.connected && editingQuote.status === QuoteStatus.ACCEPTED && getQuoteConversionIssues(editingQuote).length === 0 && (
          <button
            onClick={() => navigate(`/orders/new?quoteId=${editingQuote.id}`)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
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
        <h3 className="text-lg font-medium text-slate-900">{t("quoteBuilder.closedDealBlocked.title")}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {t("quoteBuilder.closedDealBlocked.description")}
        </p>
        <button
          onClick={() => navigate(`/deals/${referencedDeal.id}`)}
          className="w-full bg-slate-950 hover:bg-slate-900 text-white py-2 rounded-lg font-medium text-xs shadow transition-colors cursor-pointer"
        >
          {t("quoteBuilder.closedDealBlocked.backToDeal")}
        </button>
      </div>
    );
  }

  return (
    <fieldset disabled={controller.formPending || !draftHydrated} className="contents">
    <div id="quote-builder-page" style={{ "--crm-form-control-weight": 500, "--crm-form-error-border": "#fb7185" } as React.CSSProperties} className="crm-form-page !max-w-7xl space-y-6 rounded-2xl bg-slate-100/70 p-4 text-sm leading-6 sm:p-6">

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
          <span className="font-medium">{toastMessage}</span>
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


      {/* TWO COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 gap-5 items-start xl:grid-cols-12">

        {/* FULL-WIDTH EDIT CONTROLS; document preview opens in a modal. */}
        <div className="space-y-4 xl:col-span-12">

          {/* Linked Deal or Direct Customer card */}
          {referencedDeal ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 shadow-sm">
              <h2 className="font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <Landmark size={14} className="text-slate-500" />
                <span>{t("quoteBuilder.linkedDeal.title")}</span>
              </h2>
              <p className="mt-2 text-xs text-slate-600">{locale === "vi" ? "Người mua được kế thừa từ cơ hội. Báo giá mới dùng tiền tệ hiện hành của Workspace." : "Buyer is inherited from this opportunity. New Quotes use the current Workspace currency."}</p>
              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-5">
                <div>
                  <span className="text-slate-600 block text-xs font-normal">{t("quoteBuilder.linkedDeal.deal")}</span>
                  <span className="font-medium text-slate-800 block crm-text-wrap">{referencedDeal.name}</span>
                </div>
                {controller.connected ? <QuoteBuyerField facts={controller.buyerInfo} buyer={controller.currentBuyerRef} sourcePath={controller.buyerSourcePath} error={fieldError("quote-buyer")} vi={locale === "vi"} /> : <div><span className="text-slate-600 block text-xs font-normal">{t("quoteBuilder.linkedDeal.customer")}</span><span className="font-medium text-slate-700 block crm-text-wrap">{referencedDeal.customerName || referencedDeal.organizationAccountName || referencedDeal.contactName || "—"}</span></div>}
                <div>
                  <span className="text-slate-600 block text-xs font-normal">{t("quoteBuilder.linkedDeal.amount")}</span>
                  <span className="font-semibold text-indigo-700 block">
                    {formatCurrency(referencedDeal.amount, referencedDeal.currency || currency, locale)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-xs font-normal">{t("quoteBuilder.linkedDeal.stage")}</span>
                  <span className="text-indigo-600 font-medium block">
                    {getDealStageLabel(referencedDeal.stage as DealStage)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-xs font-normal">{t("quoteBuilder.linkedDeal.owner")}</span>
                  <span className="text-slate-700 block crm-text-wrap">
                    {referencedDeal.ownerId === "unassigned" ? t("common.notAvailable") : resolveWorkspaceMemberLabel(referencedDeal.ownerId, locale)}
                  </span>
                </div>
              </div>
            </div>
          ) : controller.connected ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm">
              {controller.currentBuyerRef ? <QuoteBuyerField facts={controller.buyerInfo} buyer={controller.currentBuyerRef} sourcePath={controller.buyerSourcePath} error={fieldError("quote-buyer")} vi={locale === "vi"} /> : <p className="text-sm text-slate-600">{locale === "vi" ? "Chọn người mua trong phần thông tin bên dưới." : "Choose a buyer in the section below."}</p>}
            </div>
          ) : (
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm">
              <h2 className="font-semibold text-indigo-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <FileText size={14} className="text-indigo-500" />
                <span>{locale === "vi" ? "Thông tin báo giá trực tiếp" : "Direct Customer Quotation Info"}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-1 font-medium text-xs text-slate-700">
                <div>
                  <span className="text-slate-600 block text-xs font-normal">{locale === "vi" ? "Khách hàng" : "Customer"}</span>
                  <span className="font-semibold text-slate-900 block crm-text-wrap">
                    {referencedCustomer?.name || editingQuote?.customerName || (locale === "vi" ? "Khách hàng trực tiếp" : "Direct Customer")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-xs font-normal">{locale === "vi" ? "Liên hệ" : "Contact Phone"}</span>
                  <span className="font-medium block text-slate-800">
                    {referencedCustomer?.phone || editingQuote?.customerContact || (locale === "vi" ? "Chưa gán" : "Not Assigned")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-xs font-normal">Email</span>
                  <span className="font-medium block text-slate-800 crm-text-wrap">
                    {referencedCustomer?.email || (locale === "vi" ? "Chưa gán" : "Not Assigned")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quote info Card */}
          <EffectiveFieldAccessScope fieldKey="title">
          <section tabIndex={-1} data-quote-error-target="quote-info" className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm sm:p-6">
            <SectionHeader title={locale === "vi" ? "1. Người mua và nguồn báo giá" : "1. Buyer and source"} icon={<FileText size={14} />} />
            <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">

              <div className="sm:col-span-2">
                <Input
                  id="quote-title"
                  data-quote-error-target="quote-title"
                  ref={titleInputRef}
                  label={`${t("quoteBuilder.fields.quoteTitle")} *`}
                  required
                  error={fieldError("quote-title")}
                  value={quoteTitle}
                  onChange={(e) => setQuoteTitle(e.target.value)}
                  placeholder={t("quoteBuilder.placeholders.quoteTitle")}
                />
              </div>

              <div>
                <Input
                  id="quote-number"
                  label={t("deals.quotes.quoteNumber")}
                  value={quoteNumber || (locale === "vi" ? "Số được cấp khi lưu" : "Number assigned on save")}
                  readOnly
                  className="bg-slate-100 border-slate-200 text-slate-600 font-normal tracking-normal cursor-default focus:ring-0"
                />
              </div>

              <div>
                <Select
                  id="quote-currency"
                  searchable={false}
                  data-quote-error-target="quote-currency"
                  error={fieldError("quote-currency")}
                  label={locale === "vi" ? "Tiền tệ" : "Currency"}
                  value={currency}
                  disabled={Boolean(editingQuote)}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {[...new Set([currency, ...workspaceCurrencies])].map((code) => <option key={code} value={code}>{code}</option>)}
                </Select>
                {referencedDeal && referencedDeal.currency !== currency ? <p className="mt-2 text-sm text-amber-800">{locale === "vi" ? `Cơ hội dùng ${referencedDeal.currency || "—"}; báo giá mới dùng ${currency}. Giá từ cơ hội không được sao chép vì chưa có quy đổi hợp lệ. Hãy chọn sản phẩm cùng tiền tệ hoặc nhập giá mới.` : `The opportunity uses ${referencedDeal.currency || "—"}; this new Quote uses ${currency}. Opportunity prices were not copied because conversion is unavailable. Select matching-currency products or enter new prices.`}</p> : null}
              </div>

              <div className="space-y-1.5 flex flex-col justify-start">
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider">{t("deals.quotes.status")}</span>
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
                  data-quote-error-target="referenced-deal-selector"
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
                  id="quote-valid-until"
                  data-quote-error-target="quote-valid-until"
                  error={fieldError("quote-valid-until")}
                  label={t("deals.quotes.validUntil")}
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="font-mono font-medium"
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  id="quote-recipient-email"
                  data-quote-error-target="quote-recipient-email"
                  error={fieldError("quote-recipient-email")}
                  label={locale === "vi" ? "Email nhận báo giá" : "Quote recipient email"}
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  placeholder="customer@company.com"
                />
                <span className="mt-1 block text-xs font-medium text-slate-600">
                  {locale === "vi" ? "Có thể bổ sung trước khi gửi báo giá qua email." : "Can be added before sending the quote by email."}
                </span>
              </div>

            </div>
          </section>
          </EffectiveFieldAccessScope>

          {/* Product lines and pricing */}
          {!selectedDealId && !editingQuote && !customerIdParam && !searchParams.get("organizationId") && !searchParams.get("contactId") && <QuoteBuyerSelector value={controller.directBuyer ? { ...controller.directBuyer, label: controller.connected ? controller.buyerInfo.name || (locale === "vi" ? "Người mua đã chọn" : "Selected buyer") : controller.directBuyer.label } : null} onChange={controller.setDirectBuyer} locale={locale} validationError={!controller.directBuyer ? fieldError("quote-buyer") : undefined} />}
            {controller.connected && referencedDeal && referencedDeal.interestedProducts.length > 0 && <QuoteDealProductSuggestions ids={referencedDeal.interestedProducts} onAdd={id => { controller.setSuggestedProductId(id); setIsProductPickerOpen(true); }}/>}
            <EffectiveFieldAccessScope fieldKey="lineItems">
          <section tabIndex={-1} data-quote-error-target="quote-lines" aria-invalid={Boolean(fieldError("quote-lines")) || undefined} aria-describedby={fieldError("quote-lines") ? "quote-lines-error" : undefined} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <SectionHeader
                title={locale === "vi" ? "2. Sản phẩm và giá" : "2. Products and prices"}
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
            {fieldError("quote-lines") && <p id="quote-lines-error" role="alert" data-field-error="true" className="my-3 text-xs text-rose-700">{fieldError("quote-lines")}</p>}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-slate-100 bg-transparent">
                  <TableRow>
                    <TableCell className="w-[32%] font-medium text-xs text-slate-500 uppercase tracking-wider px-2 py-3 border-none">{locale === "vi" ? "Sản phẩm / dịch vụ" : "Product / service"}</TableCell>
                    <TableCell className="w-[12%] text-center font-medium text-xs text-slate-500 uppercase tracking-wider px-2 py-3 border-none">{t("quotes.colQuantity")}</TableCell>
                    <TableCell className="w-[22%] font-medium text-xs text-slate-500 uppercase tracking-wider px-2 py-3 border-none">{t("quotes.colUnitPrice")}</TableCell>
                    <TableCell className="w-[16%] text-center font-medium text-xs text-slate-500 uppercase tracking-wider px-2 py-3 border-none">{t("quotes.colDiscount")} (%)</TableCell>
                    <TableCell className="text-right text-xs font-medium text-slate-500">{locale === "vi" ? "Thuế" : "Tax"}</TableCell>
                    <TableCell className="w-[10%] text-right font-medium text-xs text-slate-500 uppercase tracking-wider px-2 py-3 border-none">{t("quotes.colSubtotal")}</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quoteLines.map((item, index) => {
                    const lineDiscounted = (item.unitPrice ?? 0) * (1 - (item.discountPercent || 0) / 100);
                    const lineSub = pricedQuoteLines.find(line => line.id === item.id)?.lineTotal ?? lineDiscounted * (item.quantity || 0);

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
                            <Input
                              type="text"
                              value={item.productName}
                              aria-label={`${t("quotes.colProduct")} ${index + 1}`}
                              onChange={(e) => handleUpdateLineField(item.id, "productName", e.target.value)}
                              placeholder={t("quoteBuilder.placeholders.productName")} {...lineFeedback(item.id, "name", "desktop")}
 className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none"
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
                          <Input
                            type="number"
                            min="0.000001"
                            value={item.inputDecimals?.quantity ?? item.quantity}
                            aria-label={`${t("quotes.colQuantity")} ${index + 1}`}
                            onChange={(e) => handleUpdateLineField(item.id, "quantity", e.target.value)} {...lineFeedback(item.id, "quantity", "desktop")}
 className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-center font-medium text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none"
                          />
                        </TableCell>
                        <TableCell className="py-3 px-2">
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={item.inputDecimals?.unitPrice ?? item.unitPrice ?? ""}
                              readOnly={controller.connected && Boolean(item.productId)}
                              aria-label={`${t("quotes.colUnitPrice")} ${index + 1}`}
                              onChange={(e) => handleUpdateLineField(item.id, "unitPrice", e.target.value)} {...lineFeedback(item.id, "price", "desktop")}
 className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-right font-mono font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none pr-1.5"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-3 px-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={item.inputDecimals?.discountRate ?? item.discountPercent}
                            aria-label={`${t("quotes.colDiscount")} ${index + 1}`}
                            onChange={(e) => handleUpdateLineField(item.id, "discountPercent", e.target.value)} {...lineFeedback(item.id, "discount", "desktop")}
 className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-center font-medium text-xs text-indigo-700 focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none"
                          />
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-600">{formatCurrency(pricedQuoteLines.find(line => line.id === item.id)?.lineTaxAmount ?? 0, currency, locale)}</TableCell>
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
                const lineSub = pricedQuoteLines.find(line => line.id === item.id)?.lineTotal ?? lineDiscounted * (item.quantity || 0);

                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs relative space-y-3 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Input
                          type="text"
                          value={item.productName}
                          aria-label={`${t("quotes.colProduct")} ${index + 1}`}
                          onChange={(e) => handleUpdateLineField(item.id, "productName", e.target.value)}
                          placeholder={t("quoteBuilder.placeholders.productName")} {...lineFeedback(item.id, "name", "mobile")}
 className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-violet-500 focus:outline-none"
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
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wider block mb-1">
                          {t("quotes.colQuantity")}
                        </label>
                        <Input
                          type="number"
                          min="0.000001"
                          value={item.inputDecimals?.quantity ?? item.quantity}
                          aria-label={`${t("quotes.colQuantity")} ${index + 1}`}
                          onChange={(e) => handleUpdateLineField(item.id, "quantity", e.target.value)} {...lineFeedback(item.id, "quantity", "mobile")}
 className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg text-center font-medium text-xs text-slate-800 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wider block mb-1">
                          {t("quotes.colUnitPrice")}
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={item.inputDecimals?.unitPrice ?? item.unitPrice ?? ""}
                              readOnly={controller.connected && Boolean(item.productId)}
                          aria-label={`${t("quotes.colUnitPrice")} ${index + 1}`}
                          onChange={(e) => handleUpdateLineField(item.id, "unitPrice", e.target.value)} {...lineFeedback(item.id, "price", "mobile")}
 className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg text-right px-3 font-mono font-medium text-xs text-slate-800 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-dashed border-slate-100">
                      <div>
                        <label className="text-xs font-medium text-slate-600 uppercase tracking-wider block mb-1">
                          {t("quotes.colDiscount")} (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={item.inputDecimals?.discountRate ?? item.discountPercent}
                          aria-label={`${t("quotes.colDiscount")} ${index + 1}`}
                          onChange={(e) => handleUpdateLineField(item.id, "discountPercent", e.target.value)} {...lineFeedback(item.id, "discount", "mobile")}
 className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg text-center font-medium text-xs text-indigo-700 focus:ring-1 focus:ring-violet-500 focus:outline-none"
                        />
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-medium text-slate-600 uppercase tracking-wider block mb-1">
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
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-3">
                        <select
                          aria-label={locale === "vi" ? `Loại điều chỉnh ${adj.label}` : `Adjustment type ${adj.label}`}
                          value={adj.type}
                          onChange={(e) => {
                            setAdjustments(prev => prev.map(a => a.id === adj.id ? { ...a, type: e.target.value as any } : a));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10.5px] font-medium focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer text-slate-700"
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
                          className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 text-[10.5px] font-medium focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer text-slate-700"
                        >
                          <option value="PERCENTAGE">{locale === "vi" ? "Tỷ lệ (%)" : "Percentage (%)"}</option>
                          <option value="FIXED_AMOUNT">{locale === "vi" ? "Số tiền" : "Fixed amount"}</option>
                        </select>
                      </div>

                      <div className="col-span-3 sm:col-span-2">
                        <Input
                          data-quote-error-target={`adjustment-${adj.id}-value`}
                          error={fieldError(`adjustment-${adj.id}-value`)}
                          type="number"
                          aria-label={locale === "vi" ? `Giá trị ${adj.label}` : `Value ${adj.label}`}
                          min="0"
                          value={adj.value}
                          onChange={(e) => {
                            setAdjustments(prev => prev.map(a => a.id === adj.id ? { ...a, value: Number(e.target.value), valueDecimal: e.target.value } : a));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-right font-mono font-medium text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
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
          <section tabIndex={-1} data-quote-error-target="quote-payment-terms" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <SectionHeader title={locale === "vi" ? "3. Điều khoản" : "3. Terms"} />
            {fieldError("quote-payment-terms") && <p id="quote-payment-error" role="alert" data-field-error="true" className="mt-2 text-xs text-rose-700">{fieldError("quote-payment-terms")}</p>}
            {controller.paymentAgreementReadOnly && <p className="mb-4 text-sm text-slate-600">{locale === "vi" ? "Điều khoản đã lưu được giữ nguyên. Biểu mẫu hiện tại chưa hỗ trợ chỉnh sửa đầy đủ các quy tắc này." : "Saved terms are preserved. This form does not yet support editing all of these rules."}</p>}
            <fieldset disabled={controller.paymentAgreementReadOnly} aria-invalid={Boolean(fieldError("quote-payment-terms")) || undefined} aria-describedby={fieldError("quote-payment-terms") ? "quote-payment-error" : undefined} className="grid gap-4 md:grid-cols-3">
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
                    <div className="mt-1 text-xs leading-5 text-slate-600">{locale === "vi" ? "Chia khoản thanh toán thành các đợt, chọn số tiền và thời hạn cho từng đợt." : "Split payment into installments and choose the amount and due date for each."}</div>
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
            </fieldset>
              <div className="mt-4">
                <Textarea
                  id="quote-notes"
                  data-quote-error-target="quote-notes"
                  error={fieldError("quote-notes")}
                  label={t("quotes.paymentTerms")}
                  rows={4}
                  value={quoteNotes}
                  onChange={(event) => setQuoteNotes(event.target.value)}
                  className="bg-slate-50 text-xs font-semibold leading-relaxed focus:bg-white"
                />
              </div>
          </section>
          </EffectiveFieldAccessScope>

          {/* Shared form action surface */}
          {validationError && controller.validationKind === "STATUS" && <div id="quote-action-status" tabIndex={-1} role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{validationError}</div>}
          <div data-quote-builder-actions="v1" data-i18n-skip="true" data-mobile-action-bar="true" className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-violet-200 bg-white p-4 shadow-lg">
            <div className="mr-auto"><h3 className="text-sm font-semibold">{locale === "vi" ? "4. Xác nhận" : "4. Confirmation"}</h3><p className="text-xs text-slate-600">{locale === "vi" ? "Tổng dự kiến" : "Estimated total"}: {formatCurrency(quoteGrandTotal, currency, locale)}</p></div>
            {controller.connected && <Button type="button" variant="secondary" onClick={() => setReviewOpen(true)}>{locale === "vi" ? "Xem trước" : "Preview"}</Button>}
            {controller.connected && <Button type="button" variant="secondary" disabled={saveBusy || exportBusy || sendBusy} onClick={controller.handleSaveDraft}>{locale === "vi" ? "Lưu nháp" : "Save draft"}</Button>}
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
            {!controller.connected && (            <Button
              type="button"
              variant="info"
              size="sm"
              className="h-9 rounded-xl"
              onClick={handleExportPdf}
              icon={<Download size={13} />}
              disabled={controller.connected || exportBusy || sendBusy}
              title={controller.connected ? (locale === "vi" ? "Tạo & phát hành để mở PDF chính thức tại trang chi tiết báo giá." : "Create and issue the Quote to open its official PDF on the detail page.") : undefined}
            >
              {exportBusy ? "Đang tạo PDF..." : "Xuất PDF"}
            </Button>)}
            {!controller.connected && (
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
              {saveBusy ? (locale === "vi" ? "Đang lưu..." : "Saving...") : controller.connected ? (locale === "vi" ? "Tạo & phát hành báo giá" : "Create & issue Quote") : t("quoteBuilder.actions.saveDraft")}
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
            onSendGmail={controller.connected ? undefined : handleSendGmail}
            onConfirmSent={controller.connected ? undefined : handleOpenDeliveryConfirmation}
            exportBusy={exportBusy}
            sendBusy={sendBusy}
          />
        </div>

      </div>

      <QuoteDeliveryConfirmationModal
        isOpen={Boolean(deliveryConfirmation)}
        targetId={deliveryConfirmation?.quoteId}
        quoteNumber={quoteNumber}
        locale={locale}
        initialChannel={deliveryConfirmation?.channel}
        initialRecipientEmail={deliveryConfirmation?.recipientEmail}
        initialRecipient={deliveryConfirmation?.recipient}
        initialFileName={deliveryConfirmation?.fileName}
        channelLocked={deliveryConfirmation?.channelLocked}
        onClose={() => setDeliveryConfirmation(null)}
        onConfirm={async (value) => { await confirmQuoteSent(value); }}
        onSave={(value, deliveryId) => confirmQuoteSent(value, true, deliveryId)}
      />

      <QuoteBuilderProductPicker
        isOpen={isProductPickerOpen}
        onClose={() => { setIsProductPickerOpen(false); controller.setSuggestedProductId(undefined); }}
        suggestedProductId={controller.suggestedProductId}
        products={products}
        quoteLines={quoteLines}
        currency={currency}
        onChangeLines={setQuoteLines}
        onToast={triggerToast}
      />
      <QuoteDraftReview open={reviewOpen} onClose={() => setReviewOpen(false)} title={quoteTitle} buyer={controller.buyerInfo.name} lines={pricedQuoteLines} currency={currency} total={quoteGrandTotal}/>

    </div>
    </fieldset>
  );
}
