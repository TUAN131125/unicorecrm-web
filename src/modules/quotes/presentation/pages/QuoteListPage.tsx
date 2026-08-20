import { AuthoritativeQueryNotice, formatApplicationError, useServerPagedModuleCollection } from "@/shared/operations";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { acceptQuoteAndCloseDealCommand } from "@/workflows/quote-acceptance";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, BarChart3, Calendar, CheckCircle2, FolderSync, Plus, RefreshCw, Tag, User } from "lucide-react";
import type { CustomerDisplay as Customer } from "@/modules/customers";

import { QuoteApprovalStatus, QuoteStatus, type Quote } from "../../domain/model/quote.types";
import { replaceQuotes, approveQuoteCommand, duplicateQuoteCommand, createQuoteRevisionCommand, archiveQuoteCommand, archiveQuotesCommand, expireQuotesBatchCommand, recordQuoteDeliveryCommand, requestQuoteApprovalBatchCommand, requestQuoteApprovalChangesCommand, requestQuoteApprovalCommand, transitionQuoteStatusCommand } from "../../public/quotes";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { usePlatformState } from "@/platform/application-state";
import { useI18n } from "@/i18n";
import { Badge, ConfirmDialog, Table, TableHeader, TableBody, TableRow, TableCell } from "@/shared/components/ui";
import { ActionDropdownTrigger } from "@/components/crm/ActionDropdownTrigger";
import { ColumnSettingsDrawer } from "@/components/crm/ColumnSettingsDrawer";
import { OVERLAY_Z } from "@/components/overlay/overlayLayers";
import { PageHeaderActions } from "@/components/crm/PageHeaderActions";
import { ListBulkActionBar, ListPageFrame, ListPageHeader, ListPaginationBar, ListStatePanel, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import { formatCurrency } from "@/shared/lib/format/currency";
import { formatDate } from "@/shared/lib/format/date";
import { useQuotes } from "../hooks/useQuotes";
import { useDeals } from "../hooks/useDeals";
import { useQuoteListColumns } from "../hooks/useQuoteListColumns";
import { QuoteActionMenu, type QuoteActionMenuHandlers } from "../components/QuoteActionMenu";
import { QuoteDeleteConfirmDialog } from "../components/QuoteDeleteConfirmDialog";
import { QuoteListPanels } from "../components/QuoteListPanels";
import { QuoteFilterPopover } from "../components/QuoteFilterPopover";
import { QuoteStatusBadge } from "../components/QuoteStatusBadge";
import { QuoteApprovalBadge } from "../components/QuoteApprovalBadge";
import { QuoteDeliveryConfirmationModal, type QuoteDeliveryConfirmationValue } from "../components/QuoteDeliveryConfirmationModal";
import { resolveQuoteActionIds, type QuoteActionPermissions } from "../model/quoteActionPolicy";
import { requestTextInput } from "@/components/feedback/ProductDialogService";
import { createDurableId } from "@/shared/ids";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";

interface QuoteListPageProps {
  customers: Customer[];
}

// Configurable columns
const ALL_COLUMNS = [
  "quoteNumber", "title", "status", "linkedOpportunity", "customer",
  "grandTotal", "validUntil", "createdAt", "updatedAt", "owner",
  "productsCount", "acceptedAt", "sentAt"
];

const DEFAULT_COLUMNS = [
  "quoteNumber", "title", "status", "customer",
  "grandTotal", "validUntil", "actions"
];

export const QuoteListPage: React.FC<QuoteListPageProps> = ({ customers }) => {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const baseCurrency = workspaceConfiguration.localeRegion.currencies.baseCurrency;
  const { quotes } = useQuotes({ loadAuthoritative: false });
  const { deals, query: dealQuery } = useDeals();
  const access = useEffectiveAccess();
  const { session, activeWorkspace } = usePlatformState();
  const actorId = session.principal.accountId;
  const canCreateQuote = access.can(CAPABILITIES.QUOTES_CREATE);
  const canUpdateQuote = access.can(CAPABILITIES.QUOTES_UPDATE);
  const canDeleteQuote = access.can(CAPABILITIES.QUOTES_DELETE);
  const canSelectQuotes = canUpdateQuote || canDeleteQuote;

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const triggerToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // Search, View tabs, and Layout Toggle
  const [searchQuery, setSearchQuery] = useState("");
  const [isCardView, setIsCardView] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCardView(true);
      }
    };
    handleResize(); // trigger on initial load
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Filter drawer, Edit / Options dialog
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isColumnSettingOpen, setIsColumnSettingOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  // States for row actions portal
  const [rowActionAnchorEl, setRowActionAnchorEl] = useState<HTMLElement | null>(null);
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [deleteTargetQuote, setDeleteTargetQuote] = useState<Quote | null>(null);
  const [deliveryTargetQuote, setDeliveryTargetQuote] = useState<Quote | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Selected Quotes for bulk operations
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);

  // Column settings are persisted through the platform PreferenceStore.
  const { visibleColumns, saveColumnSettings, resetColumnSettings } = useQuoteListColumns(DEFAULT_COLUMNS);

  // Advanced filters state
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCustomer, setFilterCustomer] = useState<string>("");
  const [filterDeal, setFilterDeal] = useState<string>("");
  const [filterOwner, setFilterOwner] = useState<string>("");
  const [filterMinAmount, setFilterMinAmount] = useState<string>("");
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>("");
  const [filterCurrency, setFilterCurrency] = useState<string>("");
  const [filterType, setFilterType] = useState<string>(""); // 'direct' or 'linked'
  const [filterDate, setFilterDate] = useState<string>("");

  const clearFilters = () => {
    setFilterStatus("");
    setFilterCustomer("");
    setFilterDeal("");
    setFilterOwner("");
    setFilterMinAmount("");
    setFilterMaxAmount("");
    setFilterCurrency("");
    setFilterType("");
    setFilterDate("");
  };

  const hasActiveFilters = useMemo(() => {
    return !!(filterStatus || filterCustomer || filterDeal || filterOwner || filterMinAmount || filterMaxAmount || filterCurrency || filterType || filterDate);
  }, [filterStatus, filterCustomer, filterDeal, filterOwner, filterMinAmount, filterMaxAmount, filterCurrency, filterType, filterDate]);

  const activeFiltersCount = useMemo(() => {
    return [
      filterStatus,
      filterCustomer,
      filterDeal,
      filterOwner,
      filterType,
      filterMinAmount,
      filterMaxAmount,
      filterCurrency,
      filterDate
    ].filter(Boolean).length;
  }, [filterStatus, filterCustomer, filterDeal, filterOwner, filterType, filterMinAmount, filterMaxAmount, filterCurrency, filterDate]);

  // Create Mode selection
  const [creationSource, setCreationSource] = useState<"deal" | "direct">("direct");
  const [selectedSourceId, setSelectedSourceId] = useState("");

  const handleStartCreation = () => {
    setIsCreateModalOpen(false);
    if (!canCreateQuote) {
      triggerToast("error", locale === "vi" ? "Bạn không có quyền tạo báo giá." : "You do not have permission to create quotes.");
      return;
    }
    if (creationSource === "deal") {
      navigate(`/quotes/new?dealId=${selectedSourceId}`);
    } else if (creationSource === "direct") {
      if (selectedSourceId) {
        navigate(`/quotes/new?customerId=${selectedSourceId}`);
      } else {
        navigate("/quotes/new");
      }
    }
  };

  // Fetch unique customers list for dropdown filter
  const uniqueCustomers = useMemo(() => {
    const list = new Map<string, string>();
    quotes.forEach(q => {
      if (q.customerId && q.customerName) {
        list.set(q.customerId, q.customerName);
      }
    });
    return Array.from(list.entries()).map(([id, name]) => ({ id, name }));
  }, [quotes]);

  // Fetch unique linked deals list for dropdown filter
  const uniqueDeals = useMemo(() => {
    const list = new Map<string, string>();
    quotes.forEach(q => {
      if (q.dealId && q.dealName) {
        list.set(q.dealId, q.dealName);
      }
    });
    return Array.from(list.entries()).map(([id, name]) => ({ id, name }));
  }, [quotes]);

  // Fetch unique owners for dropdown filter
  const uniqueOwners = useMemo(() => {
    const list = new Set<string>();
    quotes.forEach(q => {
      if (q.senderName) {
        list.add(q.senderName);
      } else if (q.senderEmail) {
        list.add(q.senderEmail);
      }
    });
    return Array.from(list);
  }, [quotes]);

  const uniqueCurrencies = useMemo(() => Array.from(new Set(quotes.map((quote) => quote.currency || baseCurrency))).sort(), [baseCurrency, quotes]);

  // Search & Advanced Filters filtering
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const serverQuery = useMemo(() => ({
    search: deferredSearchQuery.trim() || undefined,
    sortBy: "updatedAt",
    sortDirection: "desc" as const,
    filters: {
      status: filterStatus || undefined,
      sourceDealId: filterDeal || undefined,
    },
  }), [deferredSearchQuery, filterStatus, filterDeal]);
  const serverPagination = useServerPagedModuleCollection<Quote>({
    key: "quotes",
    scopeKey: activeWorkspace.workspaceId,
    query: serverQuery,
    initialPageSize: 25,
    project: replaceQuotes,
  });

  const processedQuotes = useMemo(() => {
    return quotes.filter(quote => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const numMatch = quote.quoteNumber.toLowerCase().includes(query);
        const titleMatch = quote.title.toLowerCase().includes(query);
        const custMatch = quote.customerName?.toLowerCase().includes(query);
        const dealMatch = quote.dealName?.toLowerCase().includes(query);
        if (!numMatch && !titleMatch && !custMatch && !dealMatch) {
          return false;
        }
      }

      // 2. Advanced Filters
      if (filterStatus && quote.status !== filterStatus) return false;
      if (filterCustomer && quote.customerId !== filterCustomer) return false;
      if (filterDeal && quote.dealId !== filterDeal) return false;
      if (filterOwner && quote.senderName !== filterOwner && quote.senderEmail !== filterOwner) return false;
      if (filterType === "direct" && quote.dealId) return false;
      if (filterType === "linked" && !quote.dealId) return false;
      if (filterCurrency && (quote.currency || baseCurrency) !== filterCurrency) return false;
      if ((filterMinAmount || filterMaxAmount) && !filterCurrency) return false;
      if (filterMinAmount && quote.grandTotal < Number(filterMinAmount)) return false;
      if (filterMaxAmount && quote.grandTotal > Number(filterMaxAmount)) return false;

      if (filterDate) {
        const quoteDate = quote.createdAt?.slice(0, 10);
        if (quoteDate !== filterDate) return false;
      }

      return true;
    });
  }, [quotes, searchQuery, filterStatus, filterCustomer, filterDeal, filterOwner, filterType, filterMinAmount, filterMaxAmount, filterCurrency, filterDate]);

  const localPagination = useListPagination(processedQuotes, 25);
  const pagination = serverPagination.connected
    ? {
        page: serverPagination.page,
        setPage: serverPagination.setPage,
        pageSize: serverPagination.pageSize,
        setPageSize: serverPagination.setPageSize,
        pageCount: serverPagination.pageCount,
        pageItems: processedQuotes,
        rangeStart: serverPagination.rangeStart,
        rangeEnd: serverPagination.rangeEnd,
        totalItems: serverPagination.totalItems,
        canGoPrevious: serverPagination.canGoPrevious,
        canGoNext: serverPagination.canGoNext,
      }
    : localPagination;
  const quoteQuery = serverPagination;

  // KPIs
  const kpis = useMemo(() => {
    const totalCount = quotes.length;
    const draftCount = quotes.filter(q => q.status === QuoteStatus.DRAFT).length;
    const reviewCount = quotes.filter(q => q.status === QuoteStatus.REVIEW || (q.approvalRequired && q.approvalStatus === QuoteApprovalStatus.PENDING && q.approvalRequestedAt)).length;
    const sentCount = quotes.filter(q => q.status === QuoteStatus.SENT).length;
    const acceptedCount = quotes.filter(q => q.status === QuoteStatus.ACCEPTED).length;
    const rejectedCount = quotes.filter(q => q.status === QuoteStatus.REJECTED).length;
    const expiredCount = quotes.filter(q => q.status === QuoteStatus.EXPIRED).length;
    const rejectedExpiredCount = rejectedCount + expiredCount;
    const totalValue = quotes.reduce((sum, q) => sum + q.grandTotal, 0);
    const acceptedValue = quotes.filter(q => q.status === QuoteStatus.ACCEPTED).reduce((sum, q) => sum + q.grandTotal, 0);
    const avgValue = totalCount > 0 ? totalValue / totalCount : 0;
    const conversionRate = sentCount > 0 ? (acceptedCount / sentCount) * 100 : 0;
    const directCount = quotes.filter(q => q.sourcePath === "DIRECT_SALE").length;
    const linkedCount = quotes.filter(q => q.sourcePath === "DEAL").length;

    // Expiring soon: sent quotes with validUntil <= 7 days from now
    const expiringSoonCount = quotes.filter(q => {
      if (!q.validUntil || q.status !== QuoteStatus.SENT) return false;
      const days = Math.ceil((new Date(q.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 7;
    }).length;

    return {
      totalCount,
      draftCount,
      reviewCount,
      sentCount,
      acceptedCount,
      rejectedCount,
      expiredCount,
      rejectedExpiredCount,
      totalValue,
      acceptedValue,
      avgValue,
      conversionRate,
      directCount,
      linkedCount,
      expiringSoonCount
    };
  }, [quotes]);

  // Checkbox Selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedQuoteIds(pagination.pageItems.map(q => q.id));
    } else {
      setSelectedQuoteIds([]);
    }
  };

  const handleToggleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedQuoteIds(prev => [...prev, id]);
    } else {
      setSelectedQuoteIds(prev => prev.filter(qId => qId !== id));
    }
  };

  // Individual lifecycle actions use the Quote command boundary.
  const handleAcceptQuote = async (quoteId: string) => {
    const targetQuote = quotes.find((quote) => quote.id === quoteId);
    if (!targetQuote) return;
    const now = new Date().toISOString();
    try {
      await acceptQuoteAndCloseDealCommand(
        { quoteId },
        targetQuote.resourceVersion === undefined ? {} : { expectedVersion: targetQuote.resourceVersion },
      );
      triggerToast("success", locale === "vi"
        ? "Báo giá đã được chấp nhận. Đây là commercial commitment, không phải purchase completion."
        : "Quote accepted. This is commercial commitment, not purchase completion.");
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  const handleStatusTransition = async (quoteId: string, status: QuoteStatus) => {
    if (status === QuoteStatus.ACCEPTED) {
      await handleAcceptQuote(quoteId);
      return;
    }
    try {
      await transitionQuoteStatusCommand(quoteId, status, new Date().toISOString());
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  const handleDuplicateQuote = async (id: string) => {
    const sourceQuote = quotes.find((quote) => quote.id === id);
    if (!sourceQuote) return;
    try {
      await duplicateQuoteCommand(id, locale === "vi" ? `Bản sao - ${sourceQuote.title}` : `Copy of - ${sourceQuote.title}`);
      triggerToast("success", locale === "vi" ? "Đã tạo báo giá độc lập mới." : "Created a new independent quote.");
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  const handleCreateRevision = async (quote: Quote) => {
    try {
      const outcome = await createQuoteRevisionCommand(quote.id);
      navigate(`/quotes/${outcome.data.id}/edit`);
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  const requestDeleteQuote = (quote: Quote) => {
    setDeleteTargetQuote(quote);
  };

  const confirmDeleteQuote = async () => {
    if (!deleteTargetQuote) return;
    try {
      await archiveQuoteCommand(deleteTargetQuote.id, { reason: locale === "vi" ? "Lưu trữ từ danh sách Báo giá." : "Archived from Quote list.", actorId });
      setSelectedQuoteIds((current) => current.filter((quoteId) => quoteId !== deleteTargetQuote.id));
      setDeleteTargetQuote(null);
      triggerToast("success", locale === "vi" ? "Đã lưu trữ báo giá; lịch sử thương mại vẫn được giữ lại." : "Quote archived; commercial history was retained.");
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  const getQuoteActionPermissions = (quote: Quote): QuoteActionPermissions => {
    const canAccessRecord = access.canAccessRecord("quotes", quote);
    return {
      canView: access.can(CAPABILITIES.QUOTES_READ) && canAccessRecord,
      canUpdate: access.can(CAPABILITIES.QUOTES_UPDATE) && canAccessRecord,
      canApprove: access.can(CAPABILITIES.QUOTES_APPROVE) && canAccessRecord,
      canCreate: access.can(CAPABILITIES.QUOTES_CREATE) && canAccessRecord,
      canDelete: access.can(CAPABILITIES.QUOTES_DELETE) && canAccessRecord,
      canCreateOrder: access.can(CAPABILITIES.ORDERS_CREATE) && canAccessRecord,
    };
  };

  const quoteActionHandlers: QuoteActionMenuHandlers = {
    onView: (quote) => navigate(`/quotes/${quote.id}`),
    onEdit: (quote) => navigate(`/quotes/${quote.id}/edit`),
    onRequestApproval: async (quote) => {
      try {
        await requestQuoteApprovalCommand(quote.id, { actorId });
        triggerToast("success", locale === "vi" ? "Đã gửi yêu cầu phê duyệt." : "Approval requested.");
      } catch (error) {
        triggerToast("error", formatApplicationError(error, { locale }));
      }
    },
    onApprove: async (quote) => {
      try {
        await approveQuoteCommand(quote.id, { actorId });
        triggerToast("success", locale === "vi" ? "Đã phê duyệt Báo giá." : "Quote approved.");
      } catch (error) {
        triggerToast("error", formatApplicationError(error, { locale }));
      }
    },
    onRequestChanges: async (quote) => {
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
    },
    onSend: (quote) => navigate(`/quotes/${quote.id}/edit?action=gmail`),
    onConfirmSent: (quote) => setDeliveryTargetQuote(quote),
    onExportPdf: (quote) => navigate(`/quotes/${quote.id}?action=pdf`),
    onTransition: (quote, status) => { void handleStatusTransition(quote.id, status); },
    onCreateOrder: (quote) => navigate(`/orders/new?quoteId=${quote.id}`),
    onRevision: handleCreateRevision,
    onDuplicate: (quote) => handleDuplicateQuote(quote.id),
    onDelete: requestDeleteQuote,
    onOptimizePrice: () => triggerToast(
      "success",
      locale === "vi"
        ? "AI: Đề xuất giảm 2.5% để tăng 40% cơ hội chốt dịch vụ này."
        : "AI: Recommended 2.5% discount to boost win rate by 40%.",
    ),
  };

  const confirmQuoteSent = async (value: QuoteDeliveryConfirmationValue) => {
    if (!deliveryTargetQuote) return;
    const updated = (await recordQuoteDeliveryCommand(deliveryTargetQuote.id, {
      id: createDurableId("quote_delivery"),
      ...value,
      evidenceType: "USER_CONFIRMED_SENT",
      sentBy: actorId,
    })).data;
    setDeliveryTargetQuote(null);
    triggerToast("success", locale === "vi" ? "Đã xác nhận Báo giá được gửi và lưu kênh liên hệ." : "Quote delivery was confirmed with its contact channel.");
  };

  // Bulk action only requests internal approval. Customer delivery stays explicit per Quote.
  const handleBulkAdvanceLifecycle = async () => {
    const targetIds = quotes
      .filter((quote) => selectedQuoteIds.includes(quote.id) && quote.status === QuoteStatus.DRAFT && quote.approvalRequired && quote.approvalStatus !== QuoteApprovalStatus.APPROVED)
      .map((quote) => quote.id);
    if (targetIds.length > 0) await requestQuoteApprovalBatchCommand(targetIds, actorId);
    setSelectedQuoteIds([]);
  };

  const handleBulkMarkExpired = async () => {
    const targetIds = quotes.filter((quote) => selectedQuoteIds.includes(quote.id) && quote.status === QuoteStatus.SENT).map((quote) => quote.id);
    if (targetIds.length > 0) await expireQuotesBatchCommand(targetIds);
    setSelectedQuoteIds([]);
  };

  const handleBulkDelete = () => {
    setIsBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = async () => {
    try {
      await archiveQuotesCommand(selectedQuoteIds, { reason: locale === "vi" ? "Lưu trữ hàng loạt từ danh sách Báo giá." : "Bulk archived from Quote list.", actorId });
      setSelectedQuoteIds([]);
      setIsBulkDeleteConfirmOpen(false);
      triggerToast("success", locale === "vi" ? "Đã lưu trữ các báo giá đã chọn." : "Selected quotes archived.");
    } catch (error) {
      triggerToast("error", formatApplicationError(error, { locale }));
    }
  };

  return (
    <ListPageFrame id="quote-list-page" className="relative">

      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 ${OVERLAY_Z.toast} px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-rose-500" />}
            <span className="text-sm font-medium">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Header Portion */}
      <ListPageHeader
        title={t("quotes.list.title")}
        count={processedQuotes.length}
        context={locale === "vi" ? "Versioned commercial proposals" : "Versioned commercial proposals"}
        icon={<FolderSync size={18} />}
        actions={
          <PageHeaderActions
            actions={[
              {
                id: "quote-statistics",
                label: locale === "vi" ? "Thống kê" : "Statistics",
                icon: <BarChart3 size={13} />,
                onClick: () => setIsStatsOpen(true),
                variant: "secondary",
              },
              {
                id: "add-quote",
                label: t("quotes.list.create"),
                icon: <Plus size={14} />,
                onClick: () => setIsCreateModalOpen(true),
                variant: "primary",
                hidden: !canCreateQuote,
              },
            ]}
          />
        }
      />

      {/* 3. Toolbar & Views Filters Selector (Using Lead List design system) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-visible flex flex-col">

        {/* Action Toolbar */}
        <AuthoritativeQueryNotice connected={quoteQuery.connected} loading={quoteQuery.loading} refreshing={quoteQuery.refreshing} stale={quoteQuery.stale} loadedAt={quoteQuery.loadedAt} error={quoteQuery.error} onRefresh={() => void quoteQuery.refresh()} compact />
      {dealQuery.connected && (dealQuery.refreshing || dealQuery.stale) ? (
        <AuthoritativeQueryNotice connected={dealQuery.connected} loading={dealQuery.loading} refreshing={dealQuery.refreshing} stale={dealQuery.stale} loadedAt={dealQuery.loadedAt} error={dealQuery.error} onRefresh={() => void dealQuery.refresh()} compact />
      ) : null}

      <ListToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t("quotes.list.searchPlaceholder")}
          viewMode={isCardView ? "card" : "table"}
          onViewModeChange={(val) => setIsCardView(val === "card")}
          viewOptions={[
            { value: "table" as const, label: locale === "vi" ? "Danh sách" : "List view" },
            { value: "card" as const, label: locale === "vi" ? "Dạng thẻ" : "Card view" }
          ]}
          showFilters={true}
          onOpenFilters={() => setIsFilterOpen((open) => !open)}
          onCloseFilters={() => setIsFilterOpen(false)}
          filtersOpen={isFilterOpen}
          filtersPanel={
            <QuoteFilterPopover
              isOpen={isFilterOpen}
              onClose={() => setIsFilterOpen(false)}
              locale={locale}
              t={t}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterCustomer={filterCustomer}
              setFilterCustomer={setFilterCustomer}
              uniqueCustomers={uniqueCustomers}
              filterDeal={filterDeal}
              setFilterDeal={setFilterDeal}
              uniqueDeals={uniqueDeals}
              filterOwner={filterOwner}
              setFilterOwner={setFilterOwner}
              uniqueOwners={uniqueOwners}
              filterType={filterType}
              setFilterType={setFilterType}
              filterMinAmount={filterMinAmount}
              setFilterMinAmount={setFilterMinAmount}
              filterMaxAmount={filterMaxAmount}
              setFilterMaxAmount={setFilterMaxAmount}
              filterCurrency={filterCurrency}
              setFilterCurrency={setFilterCurrency}
              currencies={uniqueCurrencies}
              filterDate={filterDate}
              setFilterDate={setFilterDate}
              clearFilters={clearFilters}
            />
          }
          showColumns={true}
          onOpenColumns={() => setIsColumnSettingOpen(true)}
          showStats={false}
          activeFilterCount={activeFiltersCount}
          hasActiveFilters={hasActiveFilters}
          filtersLabel={t("quotes.list.filters.title")}
          columnsLabel={locale === "vi" ? "Cài đặt" : "Columns"}
          className="!border-0 !rounded-none !border-b !shadow-none"
        />

        {/* 4. Active Filter Badges */}
        {hasActiveFilters && (
          <div className="px-3 py-1.5 bg-amber-50/50 border-b border-slate-100 flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] font-medium text-amber-800 uppercase tracking-wider">{locale === "vi" ? "ĐANG LỌC:" : "ACTIVE FILTERS:"}</span>
            {filterStatus && <QuoteStatusBadge status={filterStatus as QuoteStatus} />}
            {filterCustomer && <Badge variant="neutral">{locale === "vi" ? "Khách hàng" : "Customer"}: {uniqueCustomers.find(c => c.id === filterCustomer)?.name || filterCustomer}</Badge>}
            {filterDeal && <Badge variant="neutral">{locale === "vi" ? "Cơ hội" : "Opportunity"}: {uniqueDeals.find(d => d.id === filterDeal)?.name || filterDeal}</Badge>}
            {filterOwner && <Badge variant="neutral">{locale === "vi" ? "Phụ trách" : "Owner"}: {filterOwner}</Badge>}
            {filterType && <Badge variant="neutral">{locale === "vi" ? "Loại" : "Type"}: {filterType === "direct" ? (locale === "vi" ? "Trực tiếp" : "Direct buyer") : (locale === "vi" ? "Liên kết cơ hội" : "Opportunity-linked")}</Badge>}
            {filterMinAmount && filterCurrency && <Badge variant="neutral">{locale === "vi" ? "Tối thiểu" : "Minimum"}: {formatCurrency(Number(filterMinAmount), filterCurrency, locale)}</Badge>}
            {filterMaxAmount && filterCurrency && <Badge variant="neutral">{locale === "vi" ? "Tối đa" : "Maximum"}: {formatCurrency(Number(filterMaxAmount), filterCurrency, locale)}</Badge>}
            {filterDate && <Badge variant="neutral">{locale === "vi" ? "Ngày tạo" : "Created"}: {filterDate}</Badge>}
            <button
              onClick={clearFilters}
              className="text-[10px] font-medium text-indigo-600 hover:underline cursor-pointer flex items-center gap-0.5 ml-auto"
            >
              <RefreshCw size={10} />
              {locale === "vi" ? "Xóa lọc" : "Reset Filters"}
            </button>
          </div>
        )}

        {/* 5. Shared list-archetype bulk actions */}
        <div className="px-3 py-2">
          <ListBulkActionBar
            selectedCount={selectedQuoteIds.length}
            label={locale === "vi" ? "Đã chọn báo giá" : "Quotes selected"}
            onClear={() => setSelectedQuoteIds([])}
          >
            {canUpdateQuote && <button
              type="button"
              onClick={handleBulkAdvanceLifecycle}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-indigo-700 shadow-sm hover:bg-slate-50"
            >
              {locale === "vi" ? "Gửi duyệt các Báo giá cần duyệt" : "Request approval where required"}
            </button>}
            {canUpdateQuote && <button
              type="button"
              onClick={handleBulkMarkExpired}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {locale === "vi" ? "Báo hết hạn" : "Mark Expired"}
            </button>}
            {canDeleteQuote && <button
              type="button"
              onClick={handleBulkDelete}
              className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-medium text-red-700 hover:bg-red-100"
            >
              {locale === "vi" ? "Lưu trữ" : "Archive"}
            </button>}
          </ListBulkActionBar>
        </div>

        {/* 6. List Elements Representation */}
        {quoteQuery.connected && quoteQuery.loading && quotes.length === 0 ? (
          <ListStatePanel kind="loading" title={locale === "vi" ? "Đang tải danh sách báo giá" : "Loading quotes from backend"} action={<button type="button" onClick={quoteQuery.cancel} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">{locale === "vi" ? "Hủy" : "Cancel"}</button>} />
        ) : quoteQuery.connected && quoteQuery.error && quotes.length === 0 ? (
          <ListStatePanel kind="error" title={locale === "vi" ? "Không thể tải danh sách Báo giá" : "Quote list could not be loaded"} action={<button type="button" onClick={() => void quoteQuery.refresh()} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">{locale === "vi" ? "Thử lại" : "Retry"}</button>} />
        ) : processedQuotes.length === 0 ? (
          <ListStatePanel
            kind="empty"
            title={locale === "vi" ? "Không có báo giá phù hợp" : "No matching quotes"}
            action={canCreateQuote ? <button type="button" onClick={() => setIsCreateModalOpen(true)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700">{t("quotes.list.create")}</button> : undefined}
          />
        ) : isCardView ? (
          /* CARD LIST MODE */
          <div
            data-quote-card-grid="v1"
            className="grid grid-cols-1 gap-4 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          >
            {pagination.pageItems.map((quote) => (
              <article
                key={quote.id}
                data-quote-card="v1"
                className="group flex min-h-[250px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="font-mono text-[10px] font-semibold tracking-wide text-violet-700">
                      {quote.quoteNumber} · v{quote.version}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5"><QuoteStatusBadge status={quote.status} /><QuoteApprovalBadge quote={quote} /></div>
                  </div>
                  <ActionDropdownTrigger
                    isOpen={activeQuote?.id === quote.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setRowActionAnchorEl(event.currentTarget);
                      setActiveQuote(quote);
                    }}
                    title={locale === "vi" ? `Thao tác báo giá ${quote.quoteNumber}` : `Quote actions ${quote.quoteNumber}`}
                  />
                </div>

                <div className="mt-5 flex-1 space-y-4 text-left">
                  <button
                    type="button"
                    onClick={() => navigate(`/quotes/${quote.id}`)}
                    className="crm-text-wrap text-left text-sm font-semibold leading-5 text-slate-850 transition hover:text-violet-700 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    {quote.title}
                  </button>

                  <div className="space-y-2.5 text-[11px]">
                    <div className="flex items-start gap-2 text-slate-600">
                      <User size={13} className="mt-0.5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <span className="block text-[9px] font-medium uppercase tracking-wide text-slate-400">
                          {locale === "vi" ? "Khách hàng" : "Customer"}
                        </span>
                        <span className="crm-text-wrap font-semibold text-slate-700">
                          {quote.customerName || (locale === "vi" ? "Chưa liên kết khách hàng" : "No linked customer")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-slate-600">
                      <Tag size={13} className="mt-0.5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <span className="block text-[9px] font-medium uppercase tracking-wide text-slate-400">
                          {locale === "vi" ? "Cơ hội" : "Opportunity"}
                        </span>
                        {quote.dealId ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/deals/${quote.dealId}`)}
                            className="crm-text-wrap text-left font-medium text-violet-700 hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                          >
                            {quote.dealName}
                          </button>
                        ) : (
                          <span className="font-medium text-slate-500">
                            {locale === "vi" ? "Báo giá trực tiếp" : "Direct quote"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-slate-600">
                      <Calendar size={13} className="mt-0.5 shrink-0 text-slate-400" />
                      <div>
                        <span className="block text-[9px] font-medium uppercase tracking-wide text-slate-400">
                          {locale === "vi" ? "Hiệu lực đến" : "Valid until"}
                        </span>
                        <span data-source-value={quote.validUntil || "—"} className="whitespace-nowrap font-semibold text-slate-700">{formatDate(quote.validUntil, locale) || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4 text-left">
                  <span className="block text-[9px] font-medium uppercase tracking-wide text-slate-400">
                    {locale === "vi" ? "Tổng giá trị" : "Total amount"}
                  </span>
                  <span className="mt-1 block whitespace-nowrap text-base font-semibold text-slate-900">
                    {formatCurrency(quote.grandTotal, quote.currency || baseCurrency, locale)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          /* TABLE LIST MODE */
          <div data-quote-table-scroll="scoped" className="min-w-0">
            <Table className="min-w-[1240px] w-full text-[11px]">
              <TableHeader className="bg-slate-50 font-medium border-b border-slate-100 text-slate-500">
                <TableRow>
                  <TableCell className="w-[48px] min-w-[48px] px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={pagination.pageItems.length > 0 && pagination.pageItems.every((quote) => selectedQuoteIds.includes(quote.id))}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-violet-500 cursor-pointer"
                    />
                  </TableCell>

                  {visibleColumns.includes("quoteNumber") && (
                    <TableCell className="w-[120px] min-w-[120px] text-left text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={t("quotes.list.columns.quoteNumber")}>
                      <span className="block crm-text-wrap">{t("quotes.list.columns.quoteNumberShort")}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("title") && (
                    <TableCell className="min-w-[220px] max-w-[260px] text-left text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={t("quotes.list.columns.title")}>
                      <span className="block crm-text-wrap">{t("quotes.list.columns.titleShort")}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("status") && (
                    <TableCell className="w-[120px] min-w-[120px] text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={t("quotes.list.columns.status")}>
                      <span className="block crm-text-wrap text-center">{t("quotes.list.columns.statusShort")}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("linkedOpportunity") && (
                    <TableCell className="min-w-[200px] max-w-[240px] text-left text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={t("quotes.list.columns.opportunity")}>
                      <span className="block crm-text-wrap">{t("quotes.list.columns.opportunity")}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("customer") && (
                    <TableCell className="min-w-[180px] max-w-[220px] text-left text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={t("quotes.list.columns.customer")}>
                      <span className="block crm-text-wrap">{t("quotes.list.columns.customerShort")}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("grandTotal") && (
                    <TableCell className="w-[150px] min-w-[150px] text-right text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={t("quotes.list.columns.total")}>
                      <span className="block crm-text-wrap text-right">{t("quotes.list.columns.totalShort")}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("validUntil") && (
                    <TableCell className="w-[130px] min-w-[130px] text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={t("quotes.list.columns.validUntil")}>
                      <span className="block crm-text-wrap text-center">{t("quotes.list.columns.validUntilShort")}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("createdAt") && (
                    <TableCell className="w-[130px] min-w-[130px] text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={t("quotes.list.columns.createdAt")}>
                      <span className="block crm-text-wrap text-center">{t("quotes.list.columns.createdAt")}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("updatedAt") && (
                    <TableCell className="w-[130px] min-w-[130px] text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={locale === "vi" ? "Cập nhật" : "Updated At"}>
                      <span className="block crm-text-wrap text-center">{locale === "vi" ? "Cập nhật" : "Updated At"}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("owner") && (
                    <TableCell className="min-w-[160px] max-w-[200px] text-left text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={t("quotes.list.columns.owner")}>
                      <span className="block crm-text-wrap">{t("quotes.list.columns.owner")}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("productsCount") && (
                    <TableCell className="w-[90px] min-w-[90px] text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={locale === "vi" ? "Số lượng sản phẩm" : "Products count"}>
                      <span className="block crm-text-wrap text-center">{locale === "vi" ? "SP" : "Prod Qty"}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("acceptedAt") && (
                    <TableCell className="w-[130px] min-w-[130px] text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={locale === "vi" ? "Duyệt" : "Accepted At"}>
                      <span className="block crm-text-wrap text-center">{locale === "vi" ? "Duyệt" : "Accepted At"}</span>
                    </TableCell>
                  )}
                  {visibleColumns.includes("sentAt") && (
                    <TableCell className="w-[130px] min-w-[130px] text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 px-4 py-3 whitespace-nowrap crm-text-wrap" title={locale === "vi" ? "Gửi" : "Sent At"}>
                      <span className="block crm-text-wrap text-center">{locale === "vi" ? "Gửi" : "Sent At"}</span>
                    </TableCell>
                  )}

                  <TableCell className="sticky right-0 z-20 w-[56px] min-w-[56px] border-l border-slate-200 bg-slate-50 px-2 py-3 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500 whitespace-nowrap shadow-[-10px_0_18px_-18px_rgba(15,23,42,0.7)]">
                    <span className="sr-only">{t("quotes.list.columns.actionsShort")}</span>
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pagination.pageItems.map((quote, idx) => {
                  const isChecked = selectedQuoteIds.includes(quote.id);
                  return (
                    <TableRow key={quote.id} className={`${isChecked ? "bg-indigo-50/10" : ""}`}>
                      <TableCell className="py-3 px-4.5 align-middle relative">
                        <input
                          type="checkbox"
                          aria-label={locale === "vi" ? `Chọn báo giá ${quote.quoteNumber}` : `Select quote ${quote.quoteNumber}`}
                          disabled={!canSelectQuotes}
                          checked={isChecked}
                          onChange={(e) => handleToggleSelect(quote.id, e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                        />
                      </TableCell>

                      {visibleColumns.includes("quoteNumber") && (
                        <TableCell className="w-[120px] min-w-[120px] font-mono text-[10px] font-semibold text-indigo-700 text-left select-all crm-text-wrap align-middle px-4 py-3" title={quote.quoteNumber}>
                          <span className="block crm-text-wrap">{quote.quoteNumber}</span>
                        </TableCell>
                      )}

                      {visibleColumns.includes("title") && (
                        <TableCell className="min-w-[220px] max-w-[260px] text-left font-medium text-slate-700 cursor-pointer hover:text-indigo-600 hover:underline align-middle px-4 py-3" onClick={() => navigate(`/quotes/${quote.id}`)}>
                          <div className="max-w-[220px] crm-text-wrap font-semibold text-slate-900" title={quote.title}>
                            {quote.title}
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.includes("status") && (
                        <TableCell className="w-[120px] min-w-[120px] text-center align-middle px-4 py-3">
                          <div className="inline-flex whitespace-nowrap">
                            <div className="flex flex-wrap items-center gap-1.5"><QuoteStatusBadge status={quote.status} /><QuoteApprovalBadge quote={quote} /></div>
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.includes("linkedOpportunity") && (
                        <TableCell className="min-w-[200px] max-w-[240px] text-left align-middle px-4 py-3">
                          <div className="max-w-[200px] crm-text-wrap text-indigo-600 font-semibold" title={quote.dealName || (locale === "vi" ? "Báo giá trực tiếp" : "Direct Client Quote")}>
                            {quote.dealId ? (
                              <span
                                onClick={() => navigate(`/deals/${quote.dealId}`)}
                                className="hover:underline cursor-pointer"
                              >
                                {quote.dealName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">{locale === "vi" ? "Báo giá trực tiếp" : "Direct Client Quote"}</span>
                            )}
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.includes("customer") && (
                        <TableCell className="min-w-[180px] max-w-[220px] text-left align-middle px-4 py-3">
                          <div className="max-w-[180px] crm-text-wrap font-semibold text-slate-600" title={quote.customerName || (locale === "vi" ? "Chưa có người nhận" : "No recipient")}>
                            {quote.customerName || (locale === "vi" ? "Chưa có người nhận" : "No recipient")}
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.includes("grandTotal") && (
                        <TableCell className="w-[150px] min-w-[150px] text-right font-semibold tabular-nums text-slate-800 align-middle px-4 py-3">
                          <span className="block crm-text-wrap" title={formatCurrency(quote.grandTotal, quote.currency || baseCurrency, locale)}>
                            {formatCurrency(quote.grandTotal, quote.currency || baseCurrency, locale)}
                          </span>
                        </TableCell>
                      )}

                      {visibleColumns.includes("validUntil") && (
                        <TableCell className="w-[130px] min-w-[130px] text-center font-medium font-mono text-slate-500 align-middle px-4 py-3">
                          <span className="block crm-text-wrap" title={quote.validUntil || ""}>
                            {formatDate(quote.validUntil, locale) || <span className="text-slate-350">-</span>}
                          </span>
                        </TableCell>
                      )}

                      {visibleColumns.includes("createdAt") && (
                        <TableCell className="w-[130px] min-w-[130px] text-center text-slate-500 font-mono align-middle px-4 py-3">
                          <span className="block crm-text-wrap" title={quote.createdAt || ""}>
                            {quote.createdAt || <span className="text-slate-350">-</span>}
                          </span>
                        </TableCell>
                      )}

                      {visibleColumns.includes("updatedAt") && (
                        <TableCell className="w-[130px] min-w-[130px] text-center text-slate-450 font-mono align-middle px-4 py-3">
                          <span className="block crm-text-wrap" title={quote.updatedAt || ""}>
                            {quote.updatedAt || <span className="text-slate-350">-</span>}
                          </span>
                        </TableCell>
                      )}

                      {visibleColumns.includes("owner") && (
                        <TableCell className="min-w-[160px] max-w-[200px] text-left text-slate-600 font-medium align-middle px-4 py-3">
                          <div className="max-w-[160px] crm-text-wrap" title={quote.senderName || quote.senderEmail || ""}>
                            {quote.senderName || quote.senderEmail || <span className="text-slate-350">-</span>}
                          </div>
                        </TableCell>
                      )}

                      {visibleColumns.includes("productsCount") && (
                        <TableCell className="w-[90px] min-w-[90px] text-center font-mono font-medium text-slate-600 align-middle px-4 py-3">
                          <span className="block crm-text-wrap" title={String(quote.lineItems?.length || 0)}>
                            {quote.lineItems?.length || 0}
                          </span>
                        </TableCell>
                      )}

                      {visibleColumns.includes("acceptedAt") && (
                        <TableCell className="w-[130px] min-w-[130px] text-center text-slate-500 font-mono align-middle px-4 py-3">
                          <span className="block crm-text-wrap" title={quote.acceptedAt || ""}>
                            {quote.acceptedAt || <span className="text-slate-350">-</span>}
                          </span>
                        </TableCell>
                      )}

                      {visibleColumns.includes("sentAt") && (
                        <TableCell className="w-[130px] min-w-[130px] text-center text-slate-500 font-mono align-middle px-4 py-3">
                          <span className="block crm-text-wrap" title={quote.sentAt || ""}>
                            {quote.sentAt || <span className="text-slate-350">-</span>}
                          </span>
                        </TableCell>
                      )}

                      <TableCell className={`sticky right-0 z-10 w-[56px] min-w-[56px] border-l border-slate-100 px-2 py-3 text-center align-middle shadow-[-10px_0_18px_-18px_rgba(15,23,42,0.55)] ${isChecked ? "bg-indigo-50" : "bg-white"}`}>
                        <ActionDropdownTrigger
                          isOpen={activeQuote?.id === quote.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setRowActionAnchorEl(event.currentTarget);
                            setActiveQuote(quote);
                          }}
                          title={locale === "vi" ? `Thao tác báo giá ${quote.quoteNumber}` : `Quote actions ${quote.quoteNumber}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          )}
        {processedQuotes.length > 0 ? <ListPaginationBar {...pagination} itemLabelVi="báo giá" itemLabelEn="quotes" /> : null}
      </div>

      {/* COLUMN CONFIGURATOR DRAWER */}
      <ColumnSettingsDrawer
        isOpen={isColumnSettingOpen}
        onClose={() => setIsColumnSettingOpen(false)}
        allFields={ALL_COLUMNS}
        visibleColumns={visibleColumns.filter(c => c !== "actions")}
        onSave={saveColumnSettings}
        onResetDefault={resetColumnSettings}
        translationPrefix="quotes"
      />

      <QuoteListPanels
        isCreateModalOpen={isCreateModalOpen}
        setIsCreateModalOpen={setIsCreateModalOpen}
        locale={locale}
        baseCurrency={baseCurrency}
        creationSource={creationSource}
        setCreationSource={setCreationSource}
        selectedSourceId={selectedSourceId}
        setSelectedSourceId={setSelectedSourceId}
        deals={deals}
        customers={customers}
        t={t}
        handleStartCreation={handleStartCreation}
        currencies={uniqueCurrencies}
        isStatsOpen={isStatsOpen}
        setIsStatsOpen={setIsStatsOpen}
        kpis={kpis}
      />

      {/* Shared Quote action policy rendered through the floating menu primitive */}
      {activeQuote && (
        <QuoteActionMenu
          quote={activeQuote}
          actionIds={resolveQuoteActionIds(activeQuote, getQuoteActionPermissions(activeQuote))}
          anchorEl={rowActionAnchorEl}
          isOpen={Boolean(rowActionAnchorEl)}
          onClose={() => {
            setRowActionAnchorEl(null);
            setActiveQuote(null);
          }}
          locale={locale}
          handlers={quoteActionHandlers}
        />
      )}

      <QuoteDeleteConfirmDialog
        quote={deleteTargetQuote}
        isOpen={Boolean(deleteTargetQuote)}
        onClose={() => setDeleteTargetQuote(null)}
        onConfirm={confirmDeleteQuote}
        locale={locale}
      />

      <QuoteDeliveryConfirmationModal
        isOpen={Boolean(deliveryTargetQuote)}
        quoteNumber={deliveryTargetQuote?.quoteNumber || ""}
        locale={locale}
        initialRecipientEmail={deliveryTargetQuote?.recipientEmail}
        initialRecipient={deliveryTargetQuote?.customerContact || deliveryTargetQuote?.customerName}
        onClose={() => setDeliveryTargetQuote(null)}
        onConfirm={confirmQuoteSent}
      />

      <ConfirmDialog
        id="quote-bulk-delete-confirmation"
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
        title={locale === "vi" ? "Lưu trữ các báo giá đã chọn" : "Archive selected quotes"}
        description={locale === "vi"
          ? `Bạn sắp lưu trữ ${selectedQuoteIds.length} báo giá. Hồ sơ và lịch sử vẫn được giữ lại.`
          : `You are about to archive ${selectedQuoteIds.length} quotes. Their records and history will be retained.`}
        confirmText={locale === "vi" ? "Lưu trữ báo giá" : "Archive quotes"}
        cancelText={locale === "vi" ? "Hủy" : "Cancel"}
        variant="danger"
      />
    </ListPageFrame>
  );
};
