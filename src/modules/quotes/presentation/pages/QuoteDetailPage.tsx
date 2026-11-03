import { QuoteCommercialTerms } from "../components/QuoteCommercialTerms";
import { formatCommercialMoney } from "@/shared/lib/format/commercialMoney";
import { QuoteWorkflow } from "../components/QuoteWorkflow";
import { useQuoteBuyer } from "../hooks/useQuoteBuyer";
import { useQuoteLiveRefresh } from "../hooks/useQuoteLiveRefresh";
import { QuoteCommercialPreview } from "../components/QuoteCommercialPreview";
import { QuoteLifecyclePanel } from "../components/QuoteLifecyclePanel";
import { saveQuoteDeliveryEvidence } from "../services/saveQuoteDeliveryEvidence";
import { formatApplicationError } from "@/shared/operations";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { acceptQuoteAndCloseDealCommand } from "@/workflows/quote-acceptance";
import { convertAcceptedQuoteToOrderDraftCommand } from "@/workflows/accepted-quote-order-conversion";
import { isOrderConnectedMode } from "@/modules/orders";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, Clock, Copy, Download, Edit3, Eye, FileText, MessageCircle, RefreshCw, Send, ShoppingBag, Trash2, X } from "lucide-react";
import { getDealSnapshot, getDealStagesSnapshot, isWonStage } from "@/modules/deals";
import { getQuoteConversionIssues } from "../../domain/rules/quoteConversion";
import { QuoteStatus, SalesDocumentAdjustmentType } from "../../domain/model/quote.types";
import { duplicateQuoteCommand, createQuoteRevisionCommand, archiveQuoteCommand, transitionQuoteStatusCommand } from "../../public/quotes";
import { CAPABILITIES, useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import { formatDate } from "@/shared/lib/format/date";
import { usePlatformState } from "@/platform/application-state";
import { useI18n } from "@/i18n";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useWorkspaceOperationalConfigurationResource, useWorkspaceRuntimeSettings } from "@/platform/workspace-config";
import { Button, IconButton, SectionHeader, Table, TableBody, TableCell, TableHeader, TableRow } from "@/shared/components/ui";
import { RecordDetailFrame, RecordDetailHeader, recordDetailHeaderActionButtonClassName, recordDetailHeaderActionIconButtonClassName } from "@/components/crm/detail-archetype";

import { useQuotes } from "../hooks/useQuotes";
import { getQuoteDetailResource } from "../../application/vertical-slice/quoteAuthoritativeQueries";
import { replaceQuotes } from "../../public/quotes";
import { AuthoritativeQueryBoundary, AuthoritativeQueryNotice, useModuleAuthoritativeResource } from "@/shared/operations";
import { QuoteDeleteConfirmDialog } from "../components/QuoteDeleteConfirmDialog";
import { QuoteStatusBadge } from "../components/QuoteStatusBadge";
import { QuoteDeliveryConfirmationModal, type QuoteDeliveryConfirmationValue } from "../components/QuoteDeliveryConfirmationModal";
import { QuoteBuilderPreview } from "../components/QuoteBuilderPreview";
import { createQuotePdfFromElement, downloadQuotePdf } from "../services/quotePdfExport";
import { resolveQuoteHeaderActionIds, type QuoteActionId, type QuoteActionPermissions } from "../model/quoteActionPolicy";
import { CommercialLineagePanel } from "@/components/crm/CommercialLineagePanel";
import { createDurableId } from "@/shared/ids";
import { RecordHeaderActionMenu } from "@/components/crm/RecordHeaderActionMenu";
import type { ActionDropdownItem, ActionDropdownSection } from "@/components/crm/ActionDropdown";




const QuoteAcceptanceReadinessPanel = React.lazy(() => import("../components/QuoteAcceptanceReadinessPanel"));

const detailSectionClassName = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

export const QuoteDetailPage: React.FC = () => {
  const { quoteId = "" } = useParams();
  const pricingState = useLocation().state as { quotePricingNotice?: unknown } | null;
  const pricingNotice = typeof pricingState?.quotePricingNotice === "string" ? pricingState.quotePricingNotice : undefined;
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(getQuoteDetailResource(quoteId || "__missing__"), { enabled: Boolean(quoteId), scopeKey: workspace.workspaceId, onScopeChange: () => replaceQuotes([]) });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [workflowActionHost, setWorkflowActionHost] = useState<HTMLDivElement | null>(null);
  const { t, locale } = useI18n();
  const workspaceConfiguration = useWorkspaceRuntimeSettings();
  const studioConfiguration = useWorkspaceOperationalConfigurationResource().data;
  const baseCurrency = studioConfiguration?.localeRegion.currencies.baseCurrency ?? workspaceConfiguration.baseCurrency;
  const operationGuide = {
    title: locale === "vi" ? "Hướng dẫn thao tác Báo giá" : "Quotation operation guide",
    steps: locale === "vi" ? [
      "Tiếp tục soạn nếu Báo giá còn ở trạng thái có thể chỉnh sửa.",
      "Phát hành báo giá hợp lệ, rồi gửi khách hàng.",
      "Gửi qua Gmail tại bước Gửi khách hàng; ghi nhận riêng nếu đã gửi qua kênh khác.",
      "Ghi nhận khách hàng thông báo đồng ý ở mức Chưa xác minh, hoặc ghi nhận từ chối với lý do bắt buộc.",
      "Theo dõi đơn hàng được xác nhận tự động sau khi khách chấp nhận.",
    ] : [
      "Continue editing while the quotation remains mutable.",
      "Issue a valid quote, then send it to the customer.",
      "Send via Gmail in the delivery step; record delivery separately for other channels.",
      "Record customer-reported agreement as Unverified, or record rejection with a mandatory reason.",
      "Follow automatic Order confirmation after customer acceptance.",
    ],
  } as const;
  const access = useEffectiveAccess();
  const effectiveRecordAccess = useEffectiveRecordAccessDecision();
  const { session } = usePlatformState();
  useQuoteLiveRefresh(getQuoteDetailResource(quoteId || "__missing__"), detailQuery.connected && Boolean(quoteId) && access.can(CAPABILITIES.QUOTES_READ),
    `${workspace.workspaceId}:${access.accountId}:${access.authorityRevision}`);
  const actorId = session.principal.accountId;
  const { quotes } = useQuotes({ loadAuthoritative: false, includeArchived: true });
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeliveryConfirmationOpen, setIsDeliveryConfirmationOpen] = useState(false);
  const deliveryIdentity = useRef({ quoteId, open: isDeliveryConfirmationOpen, cycle: 0, workspaceId: workspace.workspaceId });
  if (deliveryIdentity.current.quoteId !== quoteId || deliveryIdentity.current.open !== isDeliveryConfirmationOpen || deliveryIdentity.current.workspaceId !== workspace.workspaceId) deliveryIdentity.current = { quoteId, open: isDeliveryConfirmationOpen, cycle: deliveryIdentity.current.cycle + 1, workspaceId: workspace.workspaceId };
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const autoExportRef = useRef<string | null>(null);

  const quote = useMemo(() => {
    if (["AUTHENTICATION", "AUTHORIZATION", "NOT_FOUND"].includes(detailQuery.error?.category ?? "")) return undefined;
    const cached = quotes.find(item => item.id === quoteId);
    const detail = detailQuery.connected && detailQuery.data?.id === quoteId ? detailQuery.data : undefined;
    const selected = detail && (!cached || (detail.resourceVersion ?? 0) >= (cached.resourceVersion ?? 0)) ? detail : cached;
    return selected;
  }, [quotes, quoteId, detailQuery.connected, detailQuery.data, detailQuery.error]);
  const sourceDeal = useMemo(() => {
    const sourceDealId = quote?.sourceDealId || quote?.dealId;
    return sourceDealId ? getDealSnapshot(sourceDealId) : undefined;
  }, [quote]);
  const sourceDealAllowsOrder = !sourceDeal || isWonStage(sourceDeal.stage, getDealStagesSnapshot());

  const triggerToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const actionPermissions = useMemo<QuoteActionPermissions>(() => {
    if (!quote) {
      return {
        canView: false,
        canUpdate: false,
        canApprove: false,
        canCreate: false,
        canDelete: false,
        canCreateOrder: false,
      };
    }
    const canAccessRecord = access.canAccessRecord("quotes", quote);
    const serverAllows = (command: string) => !effectiveRecordAccess || effectiveRecordAccess.allowedCommands.includes(command);
    return {
      draftCoreOnly: detailQuery.connected,
      approvalCommandsReady: detailQuery.connected,
      deliveryCommandsReady: detailQuery.connected,
      canView: access.can(CAPABILITIES.QUOTES_READ) && canAccessRecord && (effectiveRecordAccess?.canRead ?? true),
      canUpdate: access.can(CAPABILITIES.QUOTES_UPDATE) && canAccessRecord && (effectiveRecordAccess?.canUpdate ?? true) && serverAllows("quote.update"),
      canApprove: access.can(CAPABILITIES.QUOTES_APPROVE) && canAccessRecord && (effectiveRecordAccess?.canApprove ?? true) && serverAllows("quote.approve"),
      canCreate: access.can(CAPABILITIES.QUOTES_CREATE) && canAccessRecord && serverAllows("quote.create"),
      canDelete: access.can(CAPABILITIES.QUOTES_DELETE) && canAccessRecord && (effectiveRecordAccess?.canDelete ?? true) && serverAllows(detailQuery.connected ? "quote.archive" : "quote.delete"),
      canCreateOrder: access.can(CAPABILITIES.ORDERS_CREATE) && canAccessRecord && sourceDealAllowsOrder && serverAllows("order.create"),
    };
  }, [access, effectiveRecordAccess, quote, sourceDealAllowsOrder, detailQuery.connected]);

  const buyer = useQuoteBuyer(quote?.buyerRef, detailQuery.connected && actionPermissions.canView);

  const headerActionIds = useMemo(
    () => quote ? resolveQuoteHeaderActionIds(quote, actionPermissions) : [],
    [actionPermissions, quote],
  );

  useEffect(() => {
    if (searchParams.get("action") !== "pdf" || !quote) return;
    if (autoExportRef.current === quote.id) return;
    autoExportRef.current = quote.id;
    const frame = window.requestAnimationFrame(() => { void handleExportPdf(); });
    return () => window.cancelAnimationFrame(frame);
  }, [quote?.id, searchParams]);

  useEffect(() => {
    if (searchParams.get("action") === "confirm" && quote) setIsDeliveryConfirmationOpen(true);
  }, [quote?.id, searchParams]);

  if (!quote) {
    return (
      <AuthoritativeQueryBoundary
        query={detailQuery}
        hasData={false}
        loadingTitleVi="Đang tải báo giá"
        loadingTitleEn="Loading quote"
        errorTitleVi="Không thể tải báo giá"
        errorTitleEn="Quote could not be loaded"
      >
        <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-10 text-xs">
          <AlertCircle size={32} className="mb-2 text-rose-500" />
          <h2 className="text-sm font-medium text-slate-800">{locale === "vi" ? "Không tìm thấy báo giá" : "Quote not found"}</h2>
          <p className="mb-4 mt-1 font-semibold text-slate-400">{locale === "vi" ? "Mã báo giá này không tồn tại hoặc không còn khả dụng." : "This quote is missing or no longer available."}</p>
          <Button variant="secondary" size="sm" onClick={() => navigate("/quotes")}>{locale === "vi" ? "Quay lại danh sách" : "Back to quotes"}</Button>
        </div>
      </AuthoritativeQueryBoundary>
    );
  }

  const handleStatusChange = async (status: QuoteStatus) => {
    const now = new Date().toISOString();
    try {
      if (status === QuoteStatus.ACCEPTED) {
        await acceptQuoteAndCloseDealCommand(
          { quoteId: quote.id },
          quote.resourceVersion === undefined ? {} : { expectedVersion: quote.resourceVersion },
        );
        triggerToast(
          "success",
          locale === "vi"
            ? "Báo giá đã được chấp nhận. Đây là commercial commitment, chưa phải hoàn tất mua hàng."
            : "Quote accepted. This is commercial commitment, not purchase completion.",
        );
      } else {
        await transitionQuoteStatusCommand(quote.id, status, now);
      }
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  const handleDuplicate = async () => {
    try {
      const outcome = await duplicateQuoteCommand(quote.id, locale === "vi" ? `Bản sao - ${quote.title}` : `Copy of - ${quote.title}`);
      navigate(`/quotes/${outcome.data.id}`);
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  const handleRevision = async () => {
    try {
      const outcome = await createQuoteRevisionCommand(quote.id);
      navigate(`/quotes/${outcome.data.id}/edit`);
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  /**
   * Accepted Quote -> Draft Order.
   *
   * Connected mode executes the canonical `order.convert-accepted-quote-to-draft`
   * command so the backend copies the immutable commercial snapshot and assigns the
   * Order identity. The generic direct-order authoring form must never be used for an
   * accepted Quote in connected mode. Demo mode keeps its separate local authoring
   * path, which the command registry classifies as OPENAPI_CONNECTED_ONLY_DEMO_SEPARATE.
   */
  const handleCreateOrder = async () => {
    if (creatingOrder) return;
    if (!isOrderConnectedMode()) {
      navigate(`/orders/new?quoteId=${quote.id}`);
      return;
    }
    const issues = getQuoteConversionIssues(quote);
    if (issues.length > 0) {
      triggerToast("error", issues.map((issue) => issue.message).join(" "));
      return;
    }
    if (quote.resourceVersion === undefined) {
      triggerToast("error", locale === "vi"
        ? "Tải lại báo giá trước khi tạo đơn hàng."
        : "Reload the quote before creating the order.");
      return;
    }
    // Deterministic per Quote version: a repeated submission replays the same
    // backend command instead of creating a second Draft Order.
    const creationIntentId = `order-intent:${quote.id}:${quote.resourceVersion}`;
    setCreatingOrder(true);
    try {
      const outcome = await convertAcceptedQuoteToOrderDraftCommand({
        creationIntentId,
        quoteId: quote.id,
        expectedQuoteVersion: quote.resourceVersion,
        idempotencyKey: `order.convert-accepted-quote:${creationIntentId}`,
      });
      navigate(`/orders/${outcome.data.order.id}`);
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    } finally {
      setCreatingOrder(false);
    }
  };

  const confirmDelete = async (isCurrent: () => boolean = () => true) => {
    try {
      await archiveQuoteCommand(quote.id, { reason: locale === "vi" ? "Lưu trữ từ trang chi tiết Báo giá." : "Archived from Quote detail.", actorId });
      if (!isCurrent()) return;
      setIsDeleteConfirmOpen(false);
      navigate("/quotes");
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  const computedQuoteFees = (quote.adjustments ?? []).reduce((sum, adjustment) => {
    if (adjustment.type === SalesDocumentAdjustmentType.DISCOUNT || adjustment.type === SalesDocumentAdjustmentType.TAX) return sum;
    return sum + (adjustment.amount || (adjustment.calculation === "FIXED_AMOUNT" ? adjustment.value : 0));
  }, 0);

  const handleExportPdf = async () => {
    const host = document.querySelector<HTMLElement>(`[data-quote-detail-pdf-host="${quote.id}"]`);
    const source = host?.querySelector<HTMLElement>('[data-quote-pdf-source="true"]');
    if (!source) {
      triggerToast("error", locale === "vi" ? "Không tìm thấy bản PDF để xuất." : "PDF source is unavailable.");
      return;
    }
    setExportBusy(true);
    try {
      const result = await createQuotePdfFromElement(source, `${quote.quoteNumber}.pdf`);
      downloadQuotePdf(result);
      triggerToast("success", locale === "vi" ? `Đã xuất ${result.fileName}.` : `Exported ${result.fileName}.`);
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    } finally {
      setExportBusy(false);
    }
  };

  const renderedDeliveryCycle = deliveryIdentity.current.cycle;
  const confirmQuoteSent = async (value: QuoteDeliveryConfirmationValue, deferClose = false, deliveryId = createDurableId("quote_delivery")): Promise<boolean> => {
    const deliveryCycle = renderedDeliveryCycle;
    if (!(await saveQuoteDeliveryEvidence(quote.id, quote.resourceVersion, value, deliveryId, actorId))) return false;
    // The mutation snapshot has no action hints. Read fresh server eligibility before
    // presenting Gmail/acceptance actions for the newly SENT Quote.
    await detailQuery.refresh();
    if (deliveryIdentity.current.cycle !== deliveryCycle) return false;
    if (!deferClose) setIsDeliveryConfirmationOpen(false);
    triggerToast("success", locale === "vi" ? "Đã ghi nhận gửi qua kênh khác." : "Delivery through another channel was recorded.");
    return true;
  };

  const renderHeaderAction = (actionId: QuoteActionId) => {
    const secondaryButton = (label: string, icon: React.ReactNode, onClick: () => void, className = "") => (
      <Button
        key={actionId}
        type="button"
        variant="secondary"
        size="sm"
        icon={icon}
        onClick={onClick}
        className={`${recordDetailHeaderActionButtonClassName} ${className}`.trim()}
      >
        {label}
      </Button>
    );
    const primaryButton = (label: string, icon: React.ReactNode, onClick: () => void) => (
      <Button
        key={actionId}
        type="button"
        variant="primary"
        size="sm"
        icon={icon}
        onClick={onClick}
        className={recordDetailHeaderActionButtonClassName}
      >
        {label}
      </Button>
    );

    switch (actionId) {
      case "edit":
        return secondaryButton(locale === "vi" ? "Tiếp tục soạn" : "Continue editing", <Edit3 size={12} />, () => navigate(`/quotes/${quote.id}/edit`));
      case "send":
        return primaryButton(locale === "vi" ? "Gửi qua Gmail" : "Send with Gmail", <Send size={12} />, () => navigate(`/quotes/${quote.id}/edit?action=gmail`));
      case "confirm-sent":
        return secondaryButton(locale === "vi" ? "Xác nhận đã gửi" : "Confirm sent", <MessageCircle size={12} />, () => setIsDeliveryConfirmationOpen(true), "border-emerald-200 text-emerald-700 hover:bg-emerald-50");
      case "accept":
        return primaryButton(locale === "vi" ? "Chấp nhận" : "Accept", <CheckCircle2 size={12} />, () => handleStatusChange(QuoteStatus.ACCEPTED));
      case "reject":
        return secondaryButton(locale === "vi" ? "Từ chối" : "Reject", <X size={12} />, () => handleStatusChange(QuoteStatus.REJECTED), "border-rose-200 text-rose-700 hover:bg-rose-50");
      case "expire":
        return secondaryButton(locale === "vi" ? "Đánh dấu hết hạn" : "Mark expired", <Clock size={12} />, () => handleStatusChange(QuoteStatus.EXPIRED));
      case "create-order":
        return (
          <Button
            key={actionId}
            type="button"
            variant="primary"
            size="sm"
            icon={<ShoppingBag size={12} />}
            loading={creatingOrder}
            disabled={creatingOrder}
            onClick={() => { void handleCreateOrder(); }}
            className={recordDetailHeaderActionButtonClassName}
          >
            {locale === "vi" ? "Tạo đơn hàng" : "Create order"}
          </Button>
        );
      case "revise":
        return secondaryButton(`Revision v${quote.version + 1}`, <RefreshCw size={12} />, handleRevision);
      case "duplicate":
        return secondaryButton(locale === "vi" ? "Nhân bản" : "Duplicate", <Copy size={12} />, handleDuplicate);
      case "export-pdf":
        return <Button key={actionId} type="button" variant="info" size="sm" icon={<Download size={12} />} loading={exportBusy} onClick={handleExportPdf} className={recordDetailHeaderActionButtonClassName}>{locale === "vi" ? "Xuất PDF" : "Export PDF"}</Button>;
      case "delete":
        return (
          <IconButton
            key={actionId}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsDeleteConfirmOpen(true)}
            title={locale === "vi" ? `Lưu trữ báo giá ${quote.quoteNumber}` : `Archive quote ${quote.quoteNumber}` }
            aria-label={locale === "vi" ? `Lưu trữ báo giá ${quote.quoteNumber}` : `Archive quote ${quote.quoteNumber}` }
            className={`${recordDetailHeaderActionIconButtonClassName} border-rose-200 text-rose-600 hover:bg-rose-50`}
          >
            <Trash2 size={13} />
          </IconButton>
        );
      default:
        return null;
    }
  };


  const primaryHeaderActionId = (["create-order", "accept", "send", "edit", "revise"] as QuoteActionId[])
    .find((id) => headerActionIds.includes(id));

  const headerMenuItem = (actionId: QuoteActionId): ActionDropdownItem | null => {
    switch (actionId) {
      case "edit": return { id: actionId, label: locale === "vi" ? "Tiếp tục soạn" : "Continue editing", icon: <Edit3 size={14} />, onClick: () => navigate(`/quotes/${quote.id}/edit`) };
      case "send": return { id: actionId, label: locale === "vi" ? "Gửi qua Gmail" : "Send with Gmail", icon: <Send size={14} />, onClick: () => navigate(`/quotes/${quote.id}/edit?action=gmail`), variant: "primary" };
      case "confirm-sent": return { id: actionId, label: locale === "vi" ? "Ghi nhận gửi qua kênh khác" : "Record delivery through another channel", icon: <MessageCircle size={14} />, onClick: () => setIsDeliveryConfirmationOpen(true), variant: "success" };
      case "accept": return { id: actionId, label: locale === "vi" ? "Chấp nhận" : "Accept", icon: <CheckCircle2 size={14} />, onClick: () => handleStatusChange(QuoteStatus.ACCEPTED), variant: "success" };
      case "reject": return { id: actionId, label: locale === "vi" ? "Từ chối" : "Reject", icon: <X size={14} />, onClick: () => handleStatusChange(QuoteStatus.REJECTED), destructive: true };
      case "expire": return { id: actionId, label: locale === "vi" ? "Đánh dấu hết hạn" : "Mark expired", icon: <Clock size={14} />, onClick: () => handleStatusChange(QuoteStatus.EXPIRED) };
      case "create-order": return { id: actionId, label: locale === "vi" ? "Tạo đơn hàng" : "Create order", icon: <ShoppingBag size={14} />, onClick: () => { void handleCreateOrder(); }, disabled: creatingOrder, variant: "primary" };
      case "revise": return { id: actionId, label: `Revision v${quote.version + 1}`, icon: <RefreshCw size={14} />, onClick: handleRevision };
      case "duplicate": return { id: actionId, label: locale === "vi" ? "Nhân bản" : "Duplicate", icon: <Copy size={14} />, onClick: handleDuplicate };
      case "export-pdf": return { id: actionId, label: locale === "vi" ? "Xuất PDF" : "Export PDF", icon: <Download size={14} />, onClick: () => { void handleExportPdf(); }, disabled: exportBusy, variant: "info" };
      case "delete": return { id: actionId, label: locale === "vi" ? "Lưu trữ Báo giá" : "Archive quotation", icon: <Trash2 size={14} />, onClick: () => setIsDeleteConfirmOpen(true), destructive: true };
      default: return null;
    }
  };

  const headerMenuSections: ActionDropdownSection[] = [
    {
      id: "delivery",
      title: locale === "vi" ? "TÀI LIỆU & GỬI KHÁCH" : "DOCUMENT & DELIVERY",
      items: headerActionIds.filter((id) => ["export-pdf", "send", "confirm-sent"].includes(id) && (!detailQuery.connected || !["send", "accept", "create-order", "export-pdf"].includes(id)) && id !== primaryHeaderActionId).map(headerMenuItem).filter((item): item is ActionDropdownItem => Boolean(item)),
    },
    {
      id: "workflow",
      title: locale === "vi" ? "THAO TÁC BÁO GIÁ" : "QUOTATION ACTIONS",
      items: headerActionIds.filter((id) => !["export-pdf", "send", "confirm-sent"].includes(id) && (!detailQuery.connected || !["send", "accept", "create-order", "export-pdf"].includes(id)) && id !== primaryHeaderActionId).map(headerMenuItem).filter((item): item is ActionDropdownItem => Boolean(item)),
    },
  ];

  return (
    <RecordDetailFrame id="quote-detail-page" className="relative text-sm leading-relaxed text-slate-700">
      {searchParams.get("pricing") === "updated" && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{pricingNotice || (locale === "vi" ? "Báo giá đã được lưu theo tổng tiền máy chủ. Hãy kiểm tra các số tiền chính thức bên dưới." : "The Quote was saved using server-calculated totals. Review the official amounts below.")}</p>}
      <AuthoritativeQueryNotice connected={detailQuery.connected} loading={detailQuery.loading} refreshing={detailQuery.refreshing} stale={detailQuery.stale} loadedAt={detailQuery.loadedAt} error={detailQuery.error} onRefresh={() => void detailQuery.refresh()} compact />
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed right-4 top-4 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${toast.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
          >
            {toast.type === "success" ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-rose-500" />}
            <span className="text-sm font-medium">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <RecordDetailHeader
        id="quote-detail-header"
        typography="commercial"
        backLabel={t("quotes.detail.backToList")}
        onBack={() => navigate("/quotes")}
        identityIcon={<FileText size={20} />}
        identityToneClassName="border-violet-200 bg-violet-50 text-violet-700"
        title={quote.title}
        status={<div className="flex flex-wrap items-center gap-2"><QuoteStatusBadge status={quote.status} size="md" /></div>}
        metadata={
          <>
            <span className="font-semibold text-violet-700">{quote.quoteNumber} · v{quote.version}</span>
            <span className="text-slate-300" aria-hidden="true">•</span>
            <span className="crm-text-wrap">{(detailQuery.connected ? buyer.name : quote.customerName) || (quote.sourcePath === "DEAL" ? (locale === "vi" ? "Báo giá từ cơ hội" : "Quote from opportunity") : (locale === "vi" ? "Báo giá trực tiếp" : "Direct quote"))}</span>
            {quote.validUntil && <span className="text-slate-500">{formatDate(quote.validUntil, locale, { timeZone: "UTC" })}</span>}
          </>
        }
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Eye size={12} />}
              onClick={() => setIsDocumentPreviewOpen(true)}
              className={recordDetailHeaderActionButtonClassName}
              data-quote-detail-preview-trigger="a4"
            >
              {locale === "vi" ? "Xem báo giá" : "View quotation"}
            </Button>
            {detailQuery.connected && <div data-quote-primary-action="workflow" ref={setWorkflowActionHost} />}
            {!detailQuery.connected && primaryHeaderActionId ? renderHeaderAction(primaryHeaderActionId) : null}
            <RecordHeaderActionMenu
              sections={headerMenuSections}
              label={locale === "vi" ? "Thao tác khác" : "More actions"}
              audit={{
                resourceKey: "quotes",
                recordId: quote.id,
                title: locale === "vi" ? "Kiểm toán Báo giá" : "Quotation audit",
                label: locale === "vi" ? "Xem lịch sử kiểm toán" : "View audit history",
                sectionTitle: locale === "vi" ? "KIỂM SOÁT" : "GOVERNANCE",
                closeLabel: locale === "vi" ? "Đóng" : "Close",
              }}
              guide={operationGuide}
              guideLabel={locale === "vi" ? "Hướng dẫn thao tác" : "Operation guide"}
              closeGuideLabel={locale === "vi" ? "Đã hiểu" : "Got it"}
            />
          </div>
        )}
      />





      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]">
        <main className="min-w-0 space-y-5">
          <section className={detailSectionClassName} aria-label={locale === "vi" ? "Tóm tắt báo giá" : "Commercial summary"}>
            <p className="text-sm text-slate-500">{locale === "vi" ? "Tổng giá trị" : "Total value"}</p>
            <p className="mt-1 text-2xl font-semibold text-violet-700">{formatCommercialMoney(quote.commercialMoney?.grandTotal ?? { amount: String(quote.grandTotal ?? 0), currency: quote.currency ?? "" }, locale)}</p>
            {studioConfiguration && quote.currency && quote.currency !== baseCurrency && <p className="mt-2 text-sm text-slate-500">{locale === "vi" ? `Giữ giá gốc ${quote.currency}. Workspace dùng ${baseCurrency}; chưa hỗ trợ quy đổi tiền tệ.` : `Original ${quote.currency} amounts are preserved. The Workspace uses ${baseCurrency}; currency conversion is unavailable.`}</p>}
            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <div><dt className="text-xs font-medium text-slate-500">{locale === "vi" ? "Người mua" : "Buyer"}</dt><dd className="mt-1">{detailQuery.connected ? buyer.name || "—" : quote.customerName || "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">{locale === "vi" ? "Cơ hội" : "Opportunity"}</dt><dd className="mt-1">{quote.dealId ? <button className="text-violet-700 hover:underline" onClick={() => navigate(`/deals/${quote.dealId}`)}>{quote.dealName || (locale === "vi" ? "Xem cơ hội" : "View opportunity")}</button> : "—"}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">{locale === "vi" ? "Hiệu lực đến" : "Valid until"}</dt><dd className="mt-1">{formatDate(quote.validUntil, locale, { timeZone: "UTC" }) || "—"}</dd></div>
            </dl>
          </section>

          <section className={detailSectionClassName}>
            <SectionHeader
              title={`${t("quotes.detail.lineItems")} (${quote.lineItems?.length || 0})`}
            />
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto" data-quote-detail-line-items-scroll="scoped">
                <Table className="min-w-[640px] w-full text-sm">
                  <TableHeader className="border-b border-slate-100 bg-slate-50 font-medium text-slate-500">
                    <TableRow>
                      <TableCell className="min-w-[220px] px-4 py-3 text-left">{locale === "vi" ? "Sản phẩm / Dịch vụ" : "Product / Service"}</TableCell>
                      <TableCell className="w-14 px-3 py-3 text-center">{locale === "vi" ? "SL" : "Qty"}</TableCell>
                      <TableCell className="w-32 px-3 py-3 text-right">{locale === "vi" ? "Đơn giá" : "Unit price"}</TableCell>
                      <TableCell className="w-20 px-3 py-3 text-center">{locale === "vi" ? "Chiết khấu" : "Discount"}</TableCell>
                      <TableCell className="w-20 px-3 py-3 text-center">{locale === "vi" ? "Thuế" : "Tax"}</TableCell>
                      <TableCell className="w-32 px-4 py-3 text-right">{locale === "vi" ? "Thành tiền" : "Line amount"}</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {(quote.lineItems || []).map((item, index) => {
                      const quantity = item.inputDecimals?.quantity ?? item.quantity;
                      const unitPrice = item.unitPriceSnapshot ?? item.unitPrice ?? 0;
                      const discountPercent = item.discountPercent || 0;
                      const lineAmount = item.lineTotal ?? 0;
                      return (
                        <TableRow key={item.id || index} className="hover:bg-slate-50/50">
                          <TableCell className="px-4 py-3 text-left">
                            <div className="font-medium text-slate-800">{item.productNameSnapshot || item.productName || "Product Name"}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {item.skuSnapshot && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">{item.skuSnapshot}</span>}
                              {item.descriptionSnapshot && <span className="max-w-[360px] text-xs leading-4 text-slate-500">{item.descriptionSnapshot}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3 text-center font-medium text-slate-700">{quantity}</TableCell>
                          <TableCell className="whitespace-nowrap px-3 py-3 text-right text-slate-600">{formatCommercialMoney(item.commercialMoney?.unitPrice ?? { amount: String(unitPrice), currency: quote.currency ?? "" }, locale)}</TableCell>
                          <TableCell className="whitespace-nowrap px-3 py-3 text-center font-semibold text-amber-700">{discountPercent}%</TableCell>
                          <TableCell className="px-3 py-3 text-center">{item.inputDecimals?.taxRate ?? item.taxRateSnapshot ?? 0}%</TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">{formatCommercialMoney(item.commercialMoney?.lineTotal ?? { amount: String(lineAmount), currency: quote.currency ?? "" }, locale)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <div className="w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
                <div className="flex items-center justify-between gap-4 text-slate-600"><span>{locale === "vi" ? "Tạm tính" : "Subtotal"}</span><span className="whitespace-nowrap font-medium text-slate-800">{formatCommercialMoney(quote.commercialMoney?.subtotal ?? { amount: String(quote.subtotal ?? 0), currency: quote.currency ?? "" }, locale)}</span></div>
                {quote.discountTotal ? <div className="flex items-center justify-between gap-4 text-amber-700"><span>{locale === "vi" ? "Chiết khấu" : "Discount"}</span><span className="whitespace-nowrap font-medium">- {formatCommercialMoney(quote.commercialMoney?.discountTotal ?? { amount: String(quote.discountTotal ?? 0), currency: quote.currency ?? "" }, locale)}</span></div> : null}
                {quote.taxTotal ? <div className="flex items-center justify-between gap-4 text-slate-600"><span>{locale === "vi" ? "Thuế" : "Tax"}</span><span className="whitespace-nowrap font-medium text-slate-800">+ {formatCommercialMoney(quote.commercialMoney?.taxTotal ?? { amount: String(quote.taxTotal ?? 0), currency: quote.currency ?? "" }, locale)}</span></div> : null}
              </div>
            </div>
          </section>

      {detailQuery.connected && <QuoteWorkflow key={`${workspace.workspaceId}:${quote.id}`} quote={quote} workspaceId={workspace.workspaceId ?? ""} vi={locale === "vi"}
        canIssue={actionPermissions.canView && access.can(CAPABILITIES.QUOTES_ISSUE_DOCUMENT) && effectiveRecordAccess?.allowedCommands.includes("quote.issueDocument") === true}
        canSend={actionPermissions.canView && quote.authoritativeActions?.sendGmail?.allowed === true}
        canRecord={actionPermissions.canView && quote.authoritativeActions?.recordSalesAcceptance?.allowed === true}
        canRecordDelivery={actionPermissions.canView && actionPermissions.canUpdate}
        onConfirmSent={() => setIsDeliveryConfirmationOpen(true)} onCommitted={() => { void detailQuery.refresh(); }} timeZone={workspaceConfiguration.timeZone} primaryActionHost={workflowActionHost} />}
          <QuoteCommercialTerms agreement={quote.paymentAgreement} notes={quote.notes || quote.termsAndNotes} vi={locale === "vi"} />
        </main>

        <aside className="min-w-0 space-y-5">

          <section><h2 className="p-2 text-sm font-medium text-slate-600">{locale === "vi" ? "Phiên bản & lưu trữ" : "Versions & archive"}</h2>
          {detailQuery.connected && <QuoteLifecyclePanel key={`lifecycle:${workspace.workspaceId}:${quote.id}`} quote={quote} workspaceId={workspace.workspaceId ?? ""} actorId={actorId} vi={locale === "vi"}
            canView={actionPermissions.canView} canCreate={actionPermissions.canCreate} canUpdate={actionPermissions.canUpdate} canArchive={actionPermissions.canDelete}
            onCreated={id => navigate(`/quotes/${id}/edit`)} onOpen={id => navigate(`/quotes/${id}`)} onCommitted={() => { void detailQuery.refresh(); }} />}

          </section>
        </aside>
      </div>

      {detailQuery.connected && access.can(CAPABILITIES.QUOTES_READ_ACCEPTANCE_EVIDENCE) && <section className={detailSectionClassName}><h2 className="mb-3 text-sm font-medium">{locale === "vi" ? "Bằng chứng & xác minh người đại diện" : "Evidence & signing authority"}</h2><React.Suspense fallback={null}><QuoteAcceptanceReadinessPanel key={`acceptance:${workspace.workspaceId}:${quote.id}`} quoteId={quote.id} workspaceId={workspace.workspaceId ?? ""} resourceVersion={quote.resourceVersion} vi={locale === "vi"} /></React.Suspense></section>}
      <CommercialLineagePanel anchorType="QUOTE" anchorId={quote.id} locale={locale} />

      {!detailQuery.connected && <div data-quote-detail-pdf-host={quote.id}>
        <QuoteBuilderPreview
          quoteNumber={quote.quoteNumber}
          currency={quote.currency || baseCurrency}
          validUntil={quote.validUntil || quote.expiryDate || ""}
          quoteTitle={quote.title}
          referencedDeal={null}
          editingQuote={quote}
          quoteLines={quote.lineItems ?? []}
          rawSubtotal={quote.subtotal}
          computedFees={computedQuoteFees}
          computedDiscounts={quote.discountTotal || 0}
          quoteGrandTotal={quote.grandTotal}
          adjustments={quote.adjustments || []}
          quoteNotes={quote.notes || quote.termsAndNotes || ""}
          onExportPdf={() => undefined}
          onSendGmail={() => undefined}
          onConfirmSent={() => undefined}
          showPreviewLauncher={false}
          previewOpen={isDocumentPreviewOpen}
          onPreviewOpenChange={setIsDocumentPreviewOpen}
        />
      </div>}
      {detailQuery.connected && <QuoteCommercialPreview quoteId={quote.id} workspaceId={workspace.workspaceId ?? ""} vi={locale === "vi"} open={isDocumentPreviewOpen} onClose={() => setIsDocumentPreviewOpen(false)} />}

      <QuoteDeleteConfirmDialog
        quote={quote}
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        locale={locale}
      />

      <QuoteDeliveryConfirmationModal
        isOpen={isDeliveryConfirmationOpen}
        targetId={quote.id}
        quoteNumber={quote.quoteNumber}
        locale={locale}
        initialRecipientEmail={quote.recipientEmail}
        initialRecipient={quote.customerContact || quote.customerName}
        onClose={() => setIsDeliveryConfirmationOpen(false)}
        onConfirm={async (value) => { await confirmQuoteSent(value); }}
        onSave={(value, deliveryId) => confirmQuoteSent(value, true, deliveryId)}
      />
    </RecordDetailFrame>
  );
};
