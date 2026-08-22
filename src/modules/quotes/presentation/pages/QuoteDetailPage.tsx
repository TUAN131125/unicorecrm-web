import { formatApplicationError } from "@/shared/operations";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { acceptQuoteAndCloseDealCommand } from "@/workflows/quote-acceptance";
import { convertAcceptedQuoteToOrderDraftCommand } from "@/workflows/accepted-quote-order-conversion";
import { isOrderConnectedMode } from "@/modules/orders";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  User,
  X,
  XSquare,
} from "lucide-react";
import { getDealSnapshot, getDealStagesSnapshot, isWonStage } from "@/modules/deals";
import { getQuoteConversionIssues } from "../../domain/rules/quoteConversion";
import { QuoteApprovalStatus, QuoteStatus, SalesDocumentAdjustmentType } from "../../domain/model/quote.types";
import { approveQuoteCommand, duplicateQuoteCommand, createQuoteRevisionCommand, archiveQuoteCommand, requestQuoteApprovalChangesCommand, requestQuoteApprovalCommand, recordQuoteDeliveryCommand, transitionQuoteStatusCommand } from "../../public/quotes";
import { CAPABILITIES, useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import { formatDate } from "@/shared/lib/format/date";
import { usePlatformState } from "@/platform/application-state";
import { useI18n } from "@/i18n";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import {
  Button,
  IconButton,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/shared/components/ui";
import {
  RecordDetailFrame,
  RecordDetailHeader,
  recordDetailHeaderActionButtonClassName,
  recordDetailHeaderActionIconButtonClassName,
} from "@/components/crm/detail-archetype";
import { formatCurrency } from "@/shared/lib/format/currency";
import { useQuotes } from "../hooks/useQuotes";
import { getQuoteDetailResource } from "../../application/vertical-slice/quoteAuthoritativeQueries";
import { replaceQuotes } from "../../public/quotes";
import { AuthoritativeQueryBoundary, AuthoritativeQueryNotice, useModuleAuthoritativeResource } from "@/shared/operations";
import { QuoteDeleteConfirmDialog } from "../components/QuoteDeleteConfirmDialog";
import { QuoteStatusBadge } from "../components/QuoteStatusBadge";
import { QuoteApprovalBadge } from "../components/QuoteApprovalBadge";
import {
  QuoteDeliveryConfirmationModal,
  type QuoteDeliveryConfirmationValue,
} from "../components/QuoteDeliveryConfirmationModal";
import { QuoteBuilderPreview } from "../components/QuoteBuilderPreview";
import { createQuotePdfFromElement, downloadQuotePdf } from "../services/quotePdfExport";
import {
  resolveQuoteHeaderActionIds,
  type QuoteActionId,
  type QuoteActionPermissions,
} from "../model/quoteActionPolicy";
import { requestTextInput } from "@/components/feedback/ProductDialogService";
import { CommercialLineagePanel } from "@/components/crm/CommercialLineagePanel";
import { createDurableId } from "@/shared/ids";
import { RecordHeaderActionMenu } from "@/components/crm/RecordHeaderActionMenu";
import type { ActionDropdownItem, ActionDropdownSection } from "@/components/crm/ActionDropdown";

const linkedRecordCardClassName = "rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left transition hover:border-violet-200 hover:bg-white";
const detailSectionClassName = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

const deliveryChannelLabel = (channel: string, vi: boolean): string => {
  const labels: Record<string, string> = {
    GMAIL: "Gmail",
    EMAIL: vi ? "email khác" : "other email",
    ZALO: "Zalo",
    CHAT_APP: vi ? "ứng dụng chat" : "chat app",
    SMS: "SMS",
    OTHER: vi ? "kênh khác" : "another channel",
    PDF: "PDF",
  };
  return labels[channel] ?? channel;
};

export const QuoteDetailPage: React.FC = () => {
  const { quoteId = "" } = useParams();
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(getQuoteDetailResource(quoteId || "__missing__"), { enabled: Boolean(quoteId), scopeKey: workspace.workspaceId, onScopeChange: () => replaceQuotes([]) });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const baseCurrency = workspaceConfiguration.localeRegion.currencies.baseCurrency;
  const operationGuide = {
    title: locale === "vi" ? "Hướng dẫn thao tác Báo giá" : "Quotation operation guide",
    steps: locale === "vi" ? [
      "Tiếp tục soạn nếu Báo giá còn ở trạng thái có thể chỉnh sửa.",
      "Gửi duyệt hoặc phê duyệt theo chính sách trước khi gửi khách.",
      "Dùng menu ba chấm để xuất PDF, gửi Gmail và xác nhận đã gửi.",
      "Sau khi khách phản hồi, cập nhật Chấp nhận, Từ chối hoặc Hết hạn.",
      "Chỉ tạo Đơn hàng từ Báo giá đã chấp nhận và còn hiệu lực.",
    ] : [
      "Continue editing while the quotation remains mutable.",
      "Request or complete approval before customer delivery.",
      "Use the three-dot menu for PDF export, Gmail, and delivery confirmation.",
      "Update Accepted, Rejected, or Expired after customer feedback.",
      "Accepting a valid quotation closes its linked Deal as Won automatically; then create the Order from the accepted version.",
    ],
  } as const;
  const access = useEffectiveAccess();
  const effectiveRecordAccess = useEffectiveRecordAccessDecision();
  const { session } = usePlatformState();
  const actorId = session.principal.accountId;
  const { quotes } = useQuotes({ loadAuthoritative: false });
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeliveryConfirmationOpen, setIsDeliveryConfirmationOpen] = useState(false);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const autoExportRef = useRef<string | null>(null);

  const quote = useMemo(() => quotes.find((item) => item.id === quoteId), [quotes, quoteId]);
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
      canView: access.can(CAPABILITIES.QUOTES_READ) && canAccessRecord && (effectiveRecordAccess?.canRead ?? true),
      canUpdate: access.can(CAPABILITIES.QUOTES_UPDATE) && canAccessRecord && (effectiveRecordAccess?.canUpdate ?? true) && serverAllows("quote.update"),
      canApprove: access.can(CAPABILITIES.QUOTES_APPROVE) && canAccessRecord && (effectiveRecordAccess?.canApprove ?? true) && serverAllows("quote.approve"),
      canCreate: access.can(CAPABILITIES.QUOTES_CREATE) && canAccessRecord && serverAllows("quote.create"),
      canDelete: access.can(CAPABILITIES.QUOTES_DELETE) && canAccessRecord && (effectiveRecordAccess?.canDelete ?? true) && serverAllows("quote.delete"),
      canCreateOrder: access.can(CAPABILITIES.ORDERS_CREATE) && canAccessRecord && sourceDealAllowsOrder && serverAllows("order.create"),
    };
  }, [access, effectiveRecordAccess, quote, sourceDealAllowsOrder]);

  const headerActionIds = useMemo(
    () => quote ? resolveQuoteHeaderActionIds(quote, actionPermissions) : [],
    [actionPermissions, quote],
  );

  const timelineEvents = useMemo(() => {
    if (!quote) return [];
    const events = [
      {
        id: "event_created",
        title: locale === "vi" ? "Đã soạn báo giá nháp" : "Quote drafted",
        desc: locale === "vi" ? `Người tạo lập: ${quote.senderName || "Hệ thống"}` : `Drafted by: ${quote.senderName || "System"}`,
        date: quote.createdAt,
        icon: <FileText size={11} className="text-slate-500" />,
      },
    ];

    if (quote.approvalRequestedAt || quote.reviewRequestedAt) {
      events.push({
        id: "event_review",
        title: locale === "vi" ? "Đã gửi yêu cầu phê duyệt" : "Approval requested",
        desc: locale === "vi"
          ? `Phiên bản v${quote.version} được duyệt theo snapshot nội dung thương mại.`
          : `Version v${quote.version} is reviewed against its commercial-content snapshot.`,
        date: quote.approvalRequestedAt || quote.reviewRequestedAt || quote.createdAt,
        icon: <ShieldCheck size={11} className="text-amber-600" />,
      });
    }

    if (quote.approvedAt && quote.approvalStatus === QuoteApprovalStatus.APPROVED) {
      events.push({
        id: "event_approved",
        title: locale === "vi" ? "Đã phê duyệt nội bộ" : "Internally approved",
        desc: locale === "vi" ? `Người duyệt: ${quote.approvedBy || "Người có thẩm quyền"}` : `Approved by: ${quote.approvedBy || "Authorized approver"}`,
        date: quote.approvedAt,
        icon: <CheckCircle2 size={11} className="text-emerald-600" />,
      });
    }

    if (quote.deliveryHistory?.length) {
      for (const delivery of quote.deliveryHistory) {
        const channel = deliveryChannelLabel(delivery.channel, locale === "vi");
        const destination = delivery.recipientEmail || delivery.recipient;
        events.push({
          id: `event_sent_${delivery.id}`,
          title: locale === "vi" ? `Đã gửi qua ${channel}` : `Sent via ${channel}`,
          desc: [destination, delivery.note].filter(Boolean).join(" · ") || (locale === "vi" ? "Đã lưu bằng chứng gửi." : "Delivery evidence recorded."),
          date: delivery.sentAt,
          icon: <Send size={11} className="text-amber-500" />,
        });
      }
    } else if (quote.sentAt) {
      events.push({
        id: "event_sent_legacy",
        title: locale === "vi" ? "Đã gửi đến khách hàng" : "Quote sent to customer",
        desc: locale === "vi" ? "Bản ghi cũ chưa lưu kênh gửi." : "Legacy record without delivery-channel evidence.",
        date: quote.sentAt,
        icon: <Send size={11} className="text-amber-500" />,
      });
    }

    if (quote.acceptedAt || quote.status === QuoteStatus.ACCEPTED) {
      events.push({
        id: "event_accepted",
        title: locale === "vi" ? "Báo giá đã được chấp nhận" : "Quote accepted",
        desc: locale === "vi"
          ? "Khách hàng đã chấp nhận báo giá. Giao dịch chỉ hoàn tất khi đơn hàng đáp ứng đủ điều kiện kết thúc."
          : "The customer accepted the quote. The transaction is completed only after the order meets its completion requirements.",
        date: quote.acceptedAt || quote.createdAt,
        icon: <ShieldCheck size={11} className="text-emerald-500" />,
      });
    }

    if (quote.status === QuoteStatus.REJECTED) {
      events.push({
        id: "event_rejected",
        title: locale === "vi" ? "Báo giá bị từ chối" : "Quote rejected",
        desc: locale === "vi" ? "Khách hàng đã từ chối báo giá." : "The quote was rejected by the customer.",
        date: quote.updatedAt || quote.createdAt,
        icon: <XSquare size={11} className="text-rose-500" />,
      });
    } else if (quote.status === QuoteStatus.EXPIRED) {
      events.push({
        id: "event_expired",
        title: locale === "vi" ? "Báo giá hết hạn hiệu lực" : "Quote expired",
        desc: locale === "vi" ? "Báo giá được đánh dấu hết hạn theo lifecycle hiện tại." : "The quote was marked expired by the current lifecycle.",
        date: quote.updatedAt || quote.createdAt,
        icon: <Clock size={11} className="text-slate-400" />,
      });
    }

    return events;
  }, [locale, quote]);

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
        loadingTitleVi="Đang tải báo giá từ backend"
        loadingTitleEn="Loading quote from backend"
        errorTitleVi="Không thể tải báo giá"
        errorTitleEn="Quote could not be loaded"
        showNotice={false}
      >
        <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-10 text-xs">
          <AlertCircle size={32} className="mb-2 text-rose-500" />
          <h2 className="text-sm font-bold text-slate-800">{locale === "vi" ? "Không tìm thấy báo giá" : "Quote not found"}</h2>
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

  const handleRequestApproval = async () => {
    try {
      await requestQuoteApprovalCommand(quote.id, { actorId });
      triggerToast("success", locale === "vi" ? "Đã gửi yêu cầu phê duyệt." : "Approval requested.");
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  const handleApprove = async () => {
    try {
      await approveQuoteCommand(quote.id, { actorId });
      triggerToast("success", locale === "vi" ? "Đã phê duyệt Báo giá." : "Quote approved.");
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  const handleRequestChanges = async () => {
    const note = await requestTextInput({
      title: locale === "vi" ? "Yêu cầu chỉnh sửa báo giá" : "Request quote changes",
      description: locale === "vi" ? "Mô tả rõ nội dung cần điều chỉnh để người phụ trách có thể cập nhật báo giá." : "Describe the changes needed so the owner can update the quote.",
      label: locale === "vi" ? "Nội dung cần chỉnh sửa" : "Requested changes",
      placeholder: locale === "vi" ? "Ví dụ: Điều chỉnh số lượng và thời hạn thanh toán" : "For example: Update quantity and payment terms",
      submitLabel: locale === "vi" ? "Gửi yêu cầu" : "Send request",
      cancelLabel: locale === "vi" ? "Hủy" : "Cancel",
      requiredMessage: locale === "vi" ? "Hãy nhập nội dung cần chỉnh sửa." : "Enter the requested changes.",
    });
    if (!note) return;
    try {
      await requestQuoteApprovalChangesCommand(quote.id, { actorId, note: note.trim() });
      triggerToast("success", locale === "vi" ? "Đã yêu cầu chỉnh sửa Báo giá." : "Changes requested.");
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
        ? "Báo giá chưa có phiên bản tài nguyên từ máy chủ. Hãy tải lại trước khi tạo Đơn hàng."
        : "The Quote has no authoritative resource version yet. Reload before creating the Order.");
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

  const confirmDelete = async () => {
    try {
      await archiveQuoteCommand(quote.id, { reason: locale === "vi" ? "Lưu trữ từ trang chi tiết Báo giá." : "Archived from Quote detail.", actorId });
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

  const confirmQuoteSent = async (value: QuoteDeliveryConfirmationValue) => {
    const updated = (await recordQuoteDeliveryCommand(quote.id, {
      id: createDurableId("quote_delivery"),
      ...value,
      evidenceType: "USER_CONFIRMED_SENT",
      sentBy: actorId,
    })).data;
    setIsDeliveryConfirmationOpen(false);
    triggerToast("success", locale === "vi" ? "Đã xác nhận Báo giá được gửi và lưu kênh liên hệ." : "Quote delivery was confirmed with its contact channel.");
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
      case "request-approval":
        return <Button key={actionId} type="button" variant="warning" size="sm" icon={<ShieldCheck size={12} />} onClick={handleRequestApproval} className={recordDetailHeaderActionButtonClassName}>{locale === "vi" ? "Gửi duyệt" : "Request approval"}</Button>;
      case "approve":
        return <Button key={actionId} type="button" variant="success" size="sm" icon={<CheckCircle2 size={12} />} onClick={handleApprove} className={recordDetailHeaderActionButtonClassName}>{locale === "vi" ? "Phê duyệt" : "Approve"}</Button>;
      case "request-changes":
        return <Button key={actionId} type="button" variant="warning" size="sm" icon={<RefreshCw size={12} />} onClick={handleRequestChanges} className={recordDetailHeaderActionButtonClassName}>{locale === "vi" ? "Yêu cầu chỉnh sửa" : "Request changes"}</Button>;
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


  const primaryHeaderActionId = (["create-order", "approve", "request-approval", "accept", "send", "edit", "revise"] as QuoteActionId[])
    .find((id) => headerActionIds.includes(id));

  const headerMenuItem = (actionId: QuoteActionId): ActionDropdownItem | null => {
    switch (actionId) {
      case "edit": return { id: actionId, label: locale === "vi" ? "Tiếp tục soạn" : "Continue editing", icon: <Edit3 size={14} />, onClick: () => navigate(`/quotes/${quote.id}/edit`) };
      case "request-approval": return { id: actionId, label: locale === "vi" ? "Gửi duyệt" : "Request approval", icon: <ShieldCheck size={14} />, onClick: handleRequestApproval, variant: "warning" };
      case "approve": return { id: actionId, label: locale === "vi" ? "Phê duyệt" : "Approve", icon: <CheckCircle2 size={14} />, onClick: handleApprove, variant: "success" };
      case "request-changes": return { id: actionId, label: locale === "vi" ? "Yêu cầu chỉnh sửa" : "Request changes", icon: <RefreshCw size={14} />, onClick: handleRequestChanges, variant: "warning" };
      case "send": return { id: actionId, label: locale === "vi" ? "Gửi qua Gmail" : "Send with Gmail", icon: <Send size={14} />, onClick: () => navigate(`/quotes/${quote.id}/edit?action=gmail`), variant: "primary" };
      case "confirm-sent": return { id: actionId, label: locale === "vi" ? "Xác nhận đã gửi" : "Confirm sent", icon: <MessageCircle size={14} />, onClick: () => setIsDeliveryConfirmationOpen(true), variant: "success" };
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
      items: headerActionIds.filter((id) => ["export-pdf", "send", "confirm-sent"].includes(id) && id !== primaryHeaderActionId).map(headerMenuItem).filter((item): item is ActionDropdownItem => Boolean(item)),
    },
    {
      id: "workflow",
      title: locale === "vi" ? "THAO TÁC BÁO GIÁ" : "QUOTATION ACTIONS",
      items: headerActionIds.filter((id) => !["export-pdf", "send", "confirm-sent"].includes(id) && id !== primaryHeaderActionId).map(headerMenuItem).filter((item): item is ActionDropdownItem => Boolean(item)),
    },
  ];

  return (
    <RecordDetailFrame id="quote-detail-page" className="relative text-xs text-slate-700">
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
        backLabel={t("quotes.detail.backToList")}
        onBack={() => navigate("/quotes")}
        identityIcon={<FileText size={20} />}
        identityToneClassName="border-violet-200 bg-violet-50 text-violet-700"
        title={quote.title}
        status={<div className="flex flex-wrap items-center gap-2"><QuoteStatusBadge status={quote.status} /><QuoteApprovalBadge quote={quote} /></div>}
        metadata={
          <>
            <span className="font-mono font-black text-violet-700">{quote.quoteNumber} · v{quote.version}</span>
            <span className="text-slate-300" aria-hidden="true">•</span>
            <span className="crm-text-wrap">{quote.customerName || (locale === "vi" ? "Báo giá trực tiếp" : "Direct quote")}</span>
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
            {primaryHeaderActionId ? renderHeaderAction(primaryHeaderActionId) : null}
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

      {quote.status === QuoteStatus.ACCEPTED && sourceDeal && !sourceDealAllowsOrder && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-bold">{locale === "vi" ? "Trạng thái Cơ hội chưa đồng bộ" : "Deal state is not synchronized"}</div>
            <div className="mt-1 text-xs font-medium text-amber-800">{locale === "vi" ? "Luồng chấp nhận Báo giá phải tự động Chốt thắng Cơ hội. Hãy mở Cơ hội để kiểm tra lỗi đồng bộ trước khi tạo Đơn hàng." : "The Quote acceptance workflow should close the Deal as Won automatically. Review the Deal synchronization issue before creating an Order."}</div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/deals/${sourceDeal.id}`)}>
            {locale === "vi" ? "Mở Cơ hội để kiểm tra" : "Review Deal"}
          </Button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <main className="min-w-0 space-y-5">
          <section className={detailSectionClassName}>
            <SectionHeader
              title={locale === "vi" ? "Thông tin chung" : "General information"}
              icon={<FileText size={14} />}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4 text-left">
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{locale === "vi" ? "Ngày tạo" : "Created"}</span>
                <div className="mt-1 whitespace-nowrap font-semibold text-slate-700">{quote.createdAt || "—"}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-left">
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{locale === "vi" ? "Hiệu lực đến" : "Valid until"}</span>
                <div className="mt-1 whitespace-nowrap font-semibold text-slate-700">{formatDate(quote.validUntil, locale) || "—"}</div>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4 text-left">
                <span className="text-[9px] font-bold uppercase tracking-wide text-violet-500">{locale === "vi" ? "Tổng giá trị" : "Total value"}</span>
                <div className="mt-1 whitespace-nowrap text-base font-black text-violet-800">{formatCurrency(quote.grandTotal, quote.currency || baseCurrency, locale)}</div>
              </div>
            </div>
          </section>

          <section className={detailSectionClassName}>
            <SectionHeader title={locale === "vi" ? "Liên kết kinh doanh" : "Linked records"} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className={linkedRecordCardClassName}>
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{locale === "vi" ? "Cơ hội liên kết" : "Linked opportunity"}</span>
                {quote.dealId ? (
                  <button type="button" onClick={() => navigate(`/deals/${quote.dealId}`)} className="mt-1 block text-left font-bold text-violet-700 hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                    {quote.dealName || quote.dealId}
                  </button>
                ) : (
                  <p className="mt-1 font-medium text-slate-500">{t("quotes.detail.directCustomerQuote")}</p>
                )}
              </div>

              <div className={linkedRecordCardClassName}>
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{locale === "vi" ? "Khách hàng nhận báo giá" : "Quote recipient"}</span>
                {quote.customerId ? (
                  <button type="button" onClick={() => navigate(`/customers/${quote.customerId}`)} className="mt-1 flex items-center gap-2 text-left font-bold text-slate-800 hover:text-violet-700 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                    <User size={13} className="shrink-0 text-sky-500" />
                    <span>{quote.customerName || "Customer Account"}</span>
                  </button>
                ) : (
                  <p className="mt-1 font-medium text-slate-500">{locale === "vi" ? "Nhập tay / Chưa liên kết" : "Manual recipient / Not linked"}</p>
                )}
                {quote.customerContact && <p className="mt-1 text-[10px] text-slate-500">{quote.customerContact}</p>}
              </div>

              <div className={linkedRecordCardClassName}>
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{locale === "vi" ? "Đơn vị cung cấp" : "Provider"}</span>
                <p className="mt-1 font-bold text-slate-800">{quote.senderName || "—"}</p>
                {quote.senderAddress && <p className="mt-1 text-[10px] leading-4 text-slate-500">{quote.senderAddress}</p>}
              </div>

              <div className={linkedRecordCardClassName}>
                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{locale === "vi" ? "Đại diện kinh doanh" : "Sales representative"}</span>
                <p className="mt-1 font-bold text-slate-800">{quote.senderEmail || "—"}</p>
                {quote.senderTaxId && <p className="mt-1 text-[10px] text-slate-500">{locale === "vi" ? "Mã số thuế" : "Tax ID"}: {quote.senderTaxId}</p>}
              </div>
            </div>
          </section>

          <section className={detailSectionClassName}>
            <SectionHeader
              title={`${t("quotes.detail.lineItems")} (${quote.lineItems?.length || 0})`}
            />
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto" data-quote-detail-line-items-scroll="scoped">
                <Table className="min-w-[760px] text-[11px]">
                  <TableHeader className="border-b border-slate-100 bg-slate-50 font-bold text-slate-500">
                    <TableRow>
                      <TableCell className="min-w-[280px] px-4 py-3 text-left">{locale === "vi" ? "Sản phẩm / Dịch vụ" : "Product / Service"}</TableCell>
                      <TableCell className="w-20 px-3 py-3 text-center">{locale === "vi" ? "SL" : "Qty"}</TableCell>
                      <TableCell className="w-36 px-3 py-3 text-right">{locale === "vi" ? "Đơn giá" : "Unit price"}</TableCell>
                      <TableCell className="w-24 px-3 py-3 text-center">{locale === "vi" ? "Chiết khấu" : "Discount"}</TableCell>
                      <TableCell className="w-40 px-4 py-3 text-right">{locale === "vi" ? "Thành tiền" : "Line amount"}</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {(quote.lineItems || []).map((item, index) => {
                      const quantity = item.quantity || 1;
                      const unitPrice = item.unitPriceSnapshot || item.unitPrice || 0;
                      const discountPercent = item.discountPercent || 0;
                      const lineAmount = quantity * unitPrice * (1 - discountPercent / 100);
                      return (
                        <TableRow key={item.id || index} className="hover:bg-slate-50/50">
                          <TableCell className="px-4 py-3 text-left">
                            <div className="font-bold text-slate-800">{item.productNameSnapshot || item.productName || "Product Name"}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {item.skuSnapshot && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-500">{item.skuSnapshot}</span>}
                              {item.descriptionSnapshot && <span className="max-w-[360px] text-[10px] leading-4 text-slate-500">{item.descriptionSnapshot}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3 text-center font-mono font-bold text-slate-700">{quantity}</TableCell>
                          <TableCell className="whitespace-nowrap px-3 py-3 text-right font-mono text-slate-600">{formatCurrency(unitPrice, quote.currency || baseCurrency, locale)}</TableCell>
                          <TableCell className="whitespace-nowrap px-3 py-3 text-center font-mono font-semibold text-amber-700">{discountPercent}%</TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-slate-900">{formatCurrency(lineAmount, quote.currency || baseCurrency, locale)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <div className="w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-[11px]">
                <div className="flex items-center justify-between gap-4 text-slate-600"><span>{locale === "vi" ? "Tạm tính" : "Subtotal"}</span><span className="whitespace-nowrap font-mono font-bold text-slate-800">{formatCurrency(quote.subtotal, quote.currency || baseCurrency, locale)}</span></div>
                {quote.discountTotal ? <div className="flex items-center justify-between gap-4 text-amber-700"><span>{locale === "vi" ? "Chiết khấu" : "Discount"}</span><span className="whitespace-nowrap font-mono font-bold">- {formatCurrency(quote.discountTotal, quote.currency || baseCurrency, locale)}</span></div> : null}
                {quote.taxTotal ? <div className="flex items-center justify-between gap-4 text-slate-600"><span>{locale === "vi" ? `Thuế (${quote.taxPercent ?? 10}%)` : `Tax (${quote.taxPercent ?? 10}%)`}</span><span className="whitespace-nowrap font-mono font-bold text-slate-800">+ {formatCurrency(quote.taxTotal, quote.currency || baseCurrency, locale)}</span></div> : null}
                <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3"><span className="font-black text-slate-900">{locale === "vi" ? "Tổng cộng" : "Total"}</span><span className="whitespace-nowrap font-mono text-sm font-black text-violet-700">{formatCurrency(quote.grandTotal, quote.currency || baseCurrency, locale)}</span></div>
              </div>
            </div>
          </section>

          {(quote.notes || quote.termsAndNotes) && (
            <section className={detailSectionClassName}>
              <SectionHeader title={locale === "vi" ? "Điều khoản và ghi chú" : "Terms and notes"} />
              <div className="mt-4 whitespace-pre-wrap text-left text-[11px] leading-5 text-slate-600">{quote.notes || quote.termsAndNotes}</div>
            </section>
          )}
        </main>

        <aside className="min-w-0">
          <section className={`${detailSectionClassName} xl:sticky xl:top-4`}>
            <SectionHeader title={t("quotes.detail.timeline")} icon={<Clock size={14} />} />
            <div className="relative mt-5 space-y-5 border-l border-slate-200 pl-5">
              {timelineEvents.map((event) => (
                <div key={event.id} className="relative text-left">
                  <span className="absolute -left-[29px] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                    {event.icon}
                  </span>
                  <h4 className="break-words font-bold leading-5 text-slate-800 [overflow-wrap:anywhere]">{event.title}</h4>
                  <p className="mt-1 break-words text-[10px] leading-4 text-slate-500">{event.desc}</p>
                  <time className="mt-2 block break-words font-mono text-[9px] font-semibold text-slate-400">{event.date || "—"}</time>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <CommercialLineagePanel anchorType="QUOTE" anchorId={quote.id} locale={locale} />

      <div data-quote-detail-pdf-host={quote.id}>
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
      </div>

      <QuoteDeleteConfirmDialog
        quote={quote}
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        locale={locale}
      />

      <QuoteDeliveryConfirmationModal
        isOpen={isDeliveryConfirmationOpen}
        quoteNumber={quote.quoteNumber}
        locale={locale}
        initialRecipientEmail={quote.recipientEmail}
        initialRecipient={quote.customerContact || quote.customerName}
        onClose={() => setIsDeliveryConfirmationOpen(false)}
        onConfirm={confirmQuoteSent}
      />
    </RecordDetailFrame>
  );
};
