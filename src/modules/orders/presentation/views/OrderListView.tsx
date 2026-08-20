import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmDialog } from "@/shared/components/ui";
import { Plus, Eye, Trash2, Edit3, CheckCircle2, Check, X, DollarSign, Package, AlertCircle, RefreshCw, Sparkles, FolderSync, Copy, Lock, FileText } from "lucide-react";
import { ActionDropdown, ActionDropdownItem } from "@/components/crm/ActionDropdown";
import { PageHeaderActions } from "@/components/crm/PageHeaderActions";
import { ListPageFrame, ListPageHeader, ListPaginationBar, ListStatePanel, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import type { CustomerOrder, OrderState } from "../../domain/model/order.types";
import type { PaymentSummaryState } from "@/modules/payments";
import { AuthoritativeQueryNotice } from "@/shared/operations";

import { OrderBulkActionBar } from "../list/OrderBulkActionBar";
import { OrderTable } from "../list/OrderTable";
import { OrderCardList } from "../list/OrderCardList";
import { OrderKanbanBoard } from "../list/OrderKanbanBoard";
import { OrderStatisticsDrawer } from "../list/OrderStatisticsDrawer";
import { OrderFilterPopover } from "../list/OrderFilterPopover";
import { OrderColumnSettingsModal } from "../list/OrderColumnSettingsModal";
import { resolveOrderActionIds } from "../model/orderActionPolicy";
import type { useOrderListController } from "../hooks/useOrderListController";

type OrderListViewController = ReturnType<typeof useOrderListController>;

export function OrderListView({ controller }: { controller: OrderListViewController }) {
  const {
    navigate,
    locale,
    tx,
    orders,
    query: orderQuery,
    serverPagination,
    access,
    path,
    canCreateOrder,
    canConfirmOrder,
    canCompleteOrder,
    orderActionPermissions,
    getPaymentState,
    getOrderEvidence,
    formatValue,
    formatDate,
    showStats,
    setShowStats,
    showFilters,
    setShowFilters,
    showColumnSettings,
    setShowColumnSettings,
    orderMenuAnchorEl,
    setOrderMenuAnchorEl,
    selectedOrder,
    setSelectedOrder,
    cancelTarget,
    setCancelTarget,
    cancelReason,
    setCancelReason,
    bulkCancelOpen,
    setBulkCancelOpen,
    view,
    handleSetView,
    statusConfigs,
    columnConfig,
    handleSaveOrderColumns,
    handleResetOrderColumns,
    alertMessage,
    setAlertMessage,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filterPayment,
    setFilterPayment,
    filterCustomer,
    setFilterCustomer,
    filterContact,
    setFilterContact,
    filterOwner,
    setFilterOwner,
    filterSourceType,
    setFilterSourceType,
    filterDateStart,
    setFilterDateStart,
    filterDateEnd,
    setFilterDateEnd,
    filterAmountMin,
    setFilterAmountMin,
    filterAmountMax,
    setFilterAmountMax,
    filterProduct,
    setFilterProduct,
    flatOrders,
    filteredOrders,
    activeFiltersCount,
    allCustomersList,
    allContactsList,
    allOwnersList,
    allProductsList,
    selectedOrderIds,
    setSelectedOrderIds,
    resetFilters,
    getStatusLabel,
    executeOrderStateUpdate,
    confirmOrderCancellation,
    archiveSingleOrder,
    duplicateOrder,
    executeBulkAction,
    handleBulkComplete,
    toggleSelectOrder,
    stats,
    handleDragStart,
    handleDragOver,
    handleDrop,
  } = controller;

  const localPagination = useListPagination(filteredOrders, 25);
  const pagination = serverPagination.connected && view !== "kanban"
    ? {
        page: serverPagination.page,
        setPage: serverPagination.setPage,
        pageSize: serverPagination.pageSize,
        setPageSize: serverPagination.setPageSize,
        pageCount: serverPagination.pageCount,
        pageItems: filteredOrders,
        rangeStart: serverPagination.rangeStart,
        rangeEnd: serverPagination.rangeEnd,
        totalItems: serverPagination.totalItems,
        canGoPrevious: serverPagination.canGoPrevious,
        canGoNext: serverPagination.canGoNext,
      }
    : localPagination;
  const toggleSelectCurrentPage = () => {
    const pageIds = pagination.pageItems.map((order) => order.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedOrderIds.includes(id));
    setSelectedOrderIds((current) => allSelected
      ? current.filter((id) => !pageIds.includes(id))
      : Array.from(new Set([...current, ...pageIds])));
  };

  const getOrderDropdownSections = (order: CustomerOrder) => {
    const rowPermissions = {
      ...orderActionPermissions,
      canConfirm: canConfirmOrder && access.canAccessRecord("orders", order),
    };
    const actionIds = resolveOrderActionIds(order, rowPermissions, getOrderEvidence(order));
    const itemsById: Record<string, ActionDropdownItem> = {
      view: { id: "view", label: locale === "vi" ? "Xem chi tiết" : "View details", icon: <Eye size={14} />, onClick: () => navigate(path(`orders/${order.id}`)) },
      edit: { id: "edit", label: locale === "vi" ? "Hiệu chỉnh" : "Edit order", icon: <Edit3 size={14} />, onClick: () => navigate(path(`orders/${order.id}/edit`)) },
      confirm: { id: "confirm", label: locale === "vi" ? "Xác nhận vận hành" : "Confirm operationally", icon: <CheckCircle2 size={14} />, onClick: () => executeOrderStateUpdate(order.id, "CONFIRMED") },
      "create-shipping": { id: "create-shipping", label: locale === "vi" ? "Tạo vận đơn" : "Create shipping booking", icon: <RefreshCw size={14} />, onClick: () => navigate(path(`shipping/new?orderId=${order.id}`)) },
      "create-invoice": { id: "create-invoice", label: locale === "vi" ? "Tạo hóa đơn nháp" : "Create draft invoice", icon: <FileText size={14} />, onClick: () => navigate(path(`invoices/new?orderId=${order.id}`)) },
      "record-payment": { id: "record-payment", label: locale === "vi" ? "Ghi nhận thanh toán" : "Record payment", icon: <DollarSign size={14} />, onClick: () => navigate(path(`payments?action=record&orderId=${order.id}`)) },
      complete: { id: "complete", label: locale === "vi" ? "Hoàn tất theo bằng chứng" : "Complete from evidence", icon: <CheckCircle2 size={14} />, onClick: () => executeOrderStateUpdate(order.id, "COMPLETED") },
      cancel: { id: "cancel", label: locale === "vi" ? "Hủy đơn hàng" : "Cancel order", icon: <X size={14} />, destructive: true, onClick: () => { setCancelTarget(order); setCancelReason(""); } },
      duplicate: { id: "duplicate", label: locale === "vi" ? "Nhân bản" : "Duplicate", icon: <Copy size={14} />, onClick: () => duplicateOrder(order) },
      archive: { id: "archive", label: locale === "vi" ? "Lưu trữ đơn hàng" : "Archive order", icon: <Trash2 size={14} />, onClick: () => { void archiveSingleOrder(order.id); } },
    };
    const workflowIds = new Set(["confirm", "create-shipping", "record-payment", "create-invoice", "complete", "cancel"]);
    const manageIds = new Set(["edit", "duplicate"]);
    return [
      { id: "access", items: actionIds.filter((id) => id === "view").map((id) => itemsById[id]) },
      { id: "workflow", title: locale === "vi" ? "NGHIỆP VỤ" : "BUSINESS", items: actionIds.filter((id) => workflowIds.has(id)).map((id) => itemsById[id]) },
      { id: "manage", title: locale === "vi" ? "QUẢN LÝ" : "MANAGEMENT", items: actionIds.filter((id) => manageIds.has(id)).map((id) => itemsById[id]) },
      { id: "retention", title: locale === "vi" ? "LƯU TRỮ" : "RETENTION", items: actionIds.filter((id) => id === "archive").map((id) => itemsById[id]) },
    ];
  };


  const ALL_COLUMN_DEFS = useMemo(() => {
    return [
      {
        key: "orderNumber",
        labelVi: "Số đơn hàng",
        labelEn: "Order details",
        width: "w-[140px]",
        render: (order: CustomerOrder) => (
          <div className="font-semibold text-slate-900 font-mono text-xs tracking-tight">
            <button
              onClick={() => navigate(path(`orders/${order.id}`))}
              className="hover:text-violet-600 transition-colors text-left font-medium"
            >
              {order.orderNumber || "ORD-N/A"}
            </button>
            <div className="text-[10px] text-slate-400 font-medium mt-1 tracking-wide uppercase flex items-center gap-1">
              <Package size={10} />
              {order.items?.length || 0} {locale === "vi" ? "mặt hàng" : "item(s)"}
            </div>
          </div>
        )
      },
      {
        key: "customer",
        labelVi: "Khách hàng",
        labelEn: "Customer",
        width: "w-[220px]",
        render: (order: CustomerOrder) => (
          <div className="font-semibold text-slate-800 text-xs crm-text-wrap max-w-[210px]" title={order.customerName}>
            {order.customerName || "N/A"}
          </div>
        )
      },
      {
        key: "contact",
        labelVi: "Liên hệ",
        labelEn: "Contact",
        width: "w-[180px]",
        render: (order: CustomerOrder) => (
          <div className="text-slate-600 text-xs crm-text-wrap max-w-[170px]" title={order.contactName}>
            {order.contactName || <span className="text-slate-400 italic font-medium">—</span>}
          </div>
        )
      },
      {
        key: "source",
        labelVi: "Nguồn",
        labelEn: "Source",
        width: "w-[160px]",
        render: (order: CustomerOrder) => (
          <div className="">
            <div className="flex flex-wrap gap-1">
              {order.sourceQuoteNumber ? (
                <span
                  onClick={() => order.sourceQuoteId && navigate(path(`quotes/${order.sourceQuoteId}`))}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-[10px] font-medium border border-violet-100 hover:underline cursor-pointer"
                >
                  <FolderSync size={9} />
                  {order.sourceQuoteNumber}
                </span>
              ) : order.sourceDealName ? (
                <span
                  onClick={() => order.sourceDealId && navigate(path(`deals/${order.sourceDealId}`))}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[10px] font-medium border border-sky-100 hover:underline cursor-pointer max-w-[145px] crm-text-wrap"
                  title={order.sourceDealName}
                >
                  <Sparkles size={9} />
                  {order.sourceDealName}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  {locale === "vi" ? "Trực tiếp" : "Direct Buy"}
                </span>
              )}
            </div>
          </div>
        )
      },
      {
        key: "sourceQuote",
        labelVi: "Mã báo giá",
        labelEn: "Source Quote",
        width: "w-[160px]",
        render: (order: CustomerOrder) => (
          <div className="text-xs font-mono font-medium text-slate-500">
            {order.sourceQuoteNumber || "—"}
          </div>
        )
      },
      {
        key: "sourceDeal",
        labelVi: "Cơ hội gốc",
        labelEn: "Source Deal",
        width: "w-[180px]",
        render: (order: CustomerOrder) => (
          <div className="text-xs text-slate-500 font-medium crm-text-wrap max-w-[170px]" title={order.sourceDealName}>
            {order.sourceDealName || "—"}
          </div>
        )
      },
      {
        key: "owner",
        labelVi: "Phụ trách",
        labelEn: "Owner",
        width: "w-[170px]",
        render: (order: CustomerOrder) => (
          <div className="text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-medium text-[9px] flex items-center justify-center shrink-0">
                {order.ownerName?.charAt(0) || "U"}
              </div>
              <span className="crm-text-wrap max-w-[124px]" title={order.ownerName}>
                {order.ownerName || "Unassigned"}
              </span>
            </div>
          </div>
        )
      },
      {
        key: "productsCount",
        labelVi: "S.Lượng SP",
        labelEn: "Products",
        width: "w-[120px]",
        render: (order: CustomerOrder) => (
          <div className="text-xs text-center font-semibold text-slate-500">
            {order.items?.length || 0}
          </div>
        )
      },
      {
        key: "completedAt",
        labelVi: "Giao hoàn tất",
        labelEn: "Completed At",
        width: "w-[140px]",
        render: (order: CustomerOrder) => (
          <div className="text-xs font-mono font-medium text-slate-500">
            {order.completedAt ? formatDate(order.completedAt) : "—"}
          </div>
        )
      },
      {
        key: "createdAt",
        labelVi: "Ngày tạo HĐ",
        labelEn: "Created At",
        width: "w-[140px]",
        render: (order: CustomerOrder) => (
          <div className="text-xs font-mono text-slate-500">
            {order.createdAt ? formatDate(order.createdAt) : "—"}
          </div>
        )
      },
      {
        key: "updatedAt",
        labelVi: "Ngày sửa",
        labelEn: "Updated At",
        width: "w-[140px]",
        render: (order: CustomerOrder) => (
          <div className="text-xs font-mono text-slate-500">
            {order.updatedAt ? formatDate(order.updatedAt) : "—"}
          </div>
        )
      },
      {
        key: "expectedDeliveryDate",
        labelVi: "Hạn giao dự kiến",
        labelEn: "Expected Delivery",
        width: "w-[145px]",
        render: (order: CustomerOrder) => (
          <div className="text-xs font-mono text-slate-500">
            {order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : "—"}
          </div>
        )
      },
      {
        key: "currency",
        labelVi: "Tiền tệ",
        labelEn: "Currency",
        width: "w-[100px]",
        render: (order: CustomerOrder) => (
          <div className="text-xs text-center font-medium text-slate-500">
            VND
          </div>
        )
      },
      {
        key: "state",
        labelVi: "Trạng thái đơn hàng",
        labelEn: "Order status",
        width: "w-[155px]",
        render: (order: CustomerOrder) => (
          <div className="text-center">
            {getStatusBadge(order.state)}
          </div>
        )
      },
      {
        key: "paymentSummary",
        labelVi: "Thanh toán",
        labelEn: "Payment",
        width: "w-[150px]",
        render: (order: CustomerOrder) => (
          <div className="text-center">
            {getPaymentBadge(getPaymentState(order))}
          </div>
        )
      },
      {
        key: "grandTotal",
        labelVi: "Trị giá",
        labelEn: "Total",
        width: "w-[150px]",
        render: (order: CustomerOrder) => (
          <div className="text-right font-semibold tabular-nums text-slate-800 text-xs whitespace-nowrap">
            {formatValue(order.grandTotal || order.totalAmount || 0, order.currency)}
          </div>
        )
      },
      {
        key: "orderDate",
        labelVi: "Mùa bán",
        labelEn: "Order Date",
        width: "w-[130px]",
        render: (order: CustomerOrder) => (
          <div className="text-slate-500 font-mono text-xs whitespace-nowrap">
            {formatDate(order.orderDate)}
          </div>
        )
      }
    ];
  }, [locale, navigate, formatDate, formatValue, statusConfigs]);


  const getStatusBadge = (status: OrderState) => {
    const config = statusConfigs.find(c => c.code === status);
    const label = config ? (locale === "vi" ? config.labelVi : config.labelEn) : status;
    const colorClass = config ? config.color : "bg-slate-100 text-slate-700 border-slate-200";

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
        {label}
      </span>
    );
  };


  // Payment badge resolver
  const getPaymentBadge = (status?: PaymentSummaryState) => {
    let style = "";
    let text = "";

    switch (status) {
      case "UNPAID":
        style = "bg-amber-100/60 text-amber-800 border-amber-200/50";
        text = locale === "vi" ? "Chưa thanh toán" : "Unpaid";
        break;
      case "PARTIAL":
        style = "bg-sky-100/50 text-sky-800 border-sky-200/50";
        text = locale === "vi" ? "Đã trả một phần" : "Paid partially";
        break;
      case "PAID":
        style = "bg-emerald-100/60 text-emerald-800 border-emerald-200";
        text = locale === "vi" ? "Đã thanh toán" : "Paid";
        break;
      case "OVERDUE":
        style = "bg-rose-100/60 text-rose-800 border-rose-200";
        text = locale === "vi" ? "Quá hạn" : "Overdue";
        break;
      case "REFUNDED":
        style = "bg-slate-100 text-slate-700 border-slate-300";
        text = locale === "vi" ? "Đã hoàn tiền" : "Refunded";
        break;
      case "FAILED":
        style = "bg-rose-100/60 text-rose-800 border-rose-200";
        text = locale === "vi" ? "Thanh toán lỗi" : "Payment failed";
        break;
      case "REVIEW":
        style = "bg-violet-100/60 text-violet-800 border-violet-200";
        text = locale === "vi" ? "Cần rà soát" : "Review";
        break;
      default:
        style = "bg-slate-100 text-slate-700 border-slate-200";
        text = locale === "vi" ? "Chưa thanh toán" : "Unpaid";
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${style}`}>
        {text}
      </span>
    );
  };


  return (
    <ListPageFrame id="order-list-page" data-guidance-id="orders.list.screen" className="overflow-visible text-slate-700">

        {/* Toast Alerts Panel */}
        <AnimatePresence>
          {alertMessage && (
            <motion.div
              initial={{ opacity: 0, y: -25, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.98 }}
              className={`p-4 rounded-2xl flex items-start gap-3 shadow-md border ${
                alertMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                  : "bg-rose-50 text-rose-800 border-rose-100"
              }`}
            >
              {alertMessage.type === "success" ? (
                <Check className="shrink-0 text-emerald-600 mt-0.5" size={18} />
              ) : (
                <AlertCircle className="shrink-0 text-rose-600 mt-0.5" size={18} />
              )}
              <div className="flex-1 text-sm font-semibold">{alertMessage.text}</div>
              <button type="button" aria-label={locale === "vi" ? "Đóng thông báo" : "Dismiss notification"} onClick={() => setAlertMessage(null)} className="text-gray-500 hover:text-gray-600 transition-all cursor-pointer">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. Page Header (Lead-List operational style) */}
        <ListPageHeader
          title={tx("orders.list.title", "Orders")}
          count={filteredOrders.length}
          context={locale === "vi" ? "Cam kết mua · Thanh toán và vận đơn được quản lý độc lập" : "Purchase commitment · Payment and Shipping Booking have separate owners"}
          icon={<Package size={18} />}
          actions={
            <div data-guidance-id="orders.list.create">
              <PageHeaderActions
                actions={[
                {
                  id: "add-order",
                  label: tx("orders.actions.create", "Create order"),
                  icon: canCreateOrder ? <Plus size={14} /> : <Lock size={12} />,
                  onClick: () => navigate(path("orders/new")),
                  variant: "primary",
                  disabled: !canCreateOrder,
                  tooltip: !canCreateOrder ? (locale === "vi" ? "Vai trò của bạn không có đặc quyền tạo đơn hàng" : "Your active role lacks privilege to create orders") : undefined,
                }
                ]}
              />
            </div>
          }
        />

        {/* 2. Shared list toolbar */}
        <AuthoritativeQueryNotice connected={orderQuery.connected} loading={orderQuery.loading} refreshing={orderQuery.refreshing} stale={orderQuery.stale} loadedAt={orderQuery.loadedAt} error={orderQuery.error} onRefresh={() => void orderQuery.refresh()} compact />

        <ListToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={locale === "vi" ? "Tìm theo số đơn, buyer, đại diện, sản phẩm..." : "Search order number, buyer, representative, product..."}
          viewMode={view}
          onViewModeChange={(mode) => handleSetView(mode as "table" | "card" | "kanban")}
          viewOptions={[
            { value: "table" as const, label: locale === "vi" ? "Danh sách" : "List" },
            { value: "card" as const, label: locale === "vi" ? "Thẻ" : "Cards" },
            { value: "kanban" as const, label: "Kanban" },
          ]}
          showStats
          onOpenStats={() => setShowStats(true)}
          statsLabel={locale === "vi" ? "Thống kê" : "Stats"}
          showFilters
          onOpenFilters={() => setShowFilters((open) => !open)}
          onCloseFilters={() => setShowFilters(false)}
          filtersOpen={showFilters}
          filtersPanel={(
            <OrderFilterPopover
              isOpen={showFilters}
              onClose={() => setShowFilters(false)}
              title={tx("orders.filters.title", "Order filters")}
              locale={locale}
              statusConfigs={statusConfigs}
              allCustomersList={allCustomersList}
              allContactsList={allContactsList}
              allOwnersList={allOwnersList}
              allProductsList={allProductsList}
              filterStatus={filterStatus}
              filterPayment={filterPayment}
              filterCustomer={filterCustomer}
              filterContact={filterContact}
              filterOwner={filterOwner}
              filterSourceType={filterSourceType}
              filterProduct={filterProduct}
              filterAmountMin={filterAmountMin}
              filterAmountMax={filterAmountMax}
              filterDateStart={filterDateStart}
              filterDateEnd={filterDateEnd}
              onStatusChange={setFilterStatus}
              onPaymentChange={setFilterPayment}
              onCustomerChange={setFilterCustomer}
              onContactChange={setFilterContact}
              onOwnerChange={setFilterOwner}
              onSourceTypeChange={setFilterSourceType}
              onProductChange={setFilterProduct}
              onAmountMinChange={setFilterAmountMin}
              onAmountMaxChange={setFilterAmountMax}
              onDateStartChange={setFilterDateStart}
              onDateEndChange={setFilterDateEnd}
              onReset={resetFilters}
            />
          )}
          activeFilterCount={activeFiltersCount}
          hasActiveFilters={activeFiltersCount > 0}
          filtersLabel={locale === "vi" ? "Bộ lọc" : "Filters"}
          showColumns
          onOpenColumns={() => setShowColumnSettings(true)}
          columnsLabel={locale === "vi" ? "Cột" : "Columns"}
          rightSlot={(activeFiltersCount > 0 || searchTerm !== "") ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-100 bg-rose-50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100"
            >
              <RefreshCw size={13} />
              <span>{locale === "vi" ? "Đặt lại" : "Reset"}</span>
            </button>
          ) : undefined}
        />

        {/* 4. Active Filter Tags Indicator */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center mt-[-10px] gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider pl-1 mr-1">
              {locale === "vi" ? "Bộ lọc đang chạy:" : "Active Filters:"}
            </span>

            {filterStatus !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 shadow-3xs">
                <span>Trạng thái: {getStatusLabel(filterStatus as OrderState)}</span>
                <X size={12} className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setFilterStatus("all")} />
              </span>
            )}
            {filterPayment !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 shadow-3xs">
                <span>Thanh toán: {filterPayment}</span>
                <X size={12} className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setFilterPayment("all")} />
              </span>
            )}
            {filterCustomer !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 shadow-3xs">
                <span>Khách hàng: {filterCustomer}</span>
                <X size={12} className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setFilterCustomer("all")} />
              </span>
            )}
            {filterContact !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 shadow-3xs">
                <span>Đại diện: {filterContact}</span>
                <X size={12} className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setFilterContact("all")} />
              </span>
            )}
            {filterOwner !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 shadow-3xs">
                <span>Phụ trách: {filterOwner}</span>
                <X size={12} className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setFilterOwner("all")} />
              </span>
            )}
            {filterSourceType !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 shadow-3xs">
                <span>Nguồn: {filterSourceType}</span>
                <X size={12} className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setFilterSourceType("all")} />
              </span>
            )}
            {filterProduct !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 shadow-3xs">
                <span>Sản phẩm: {filterProduct}</span>
                <X size={12} className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setFilterProduct("all")} />
              </span>
            )}
            {filterAmountMin && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 shadow-3xs">
                <span>Trị giá từ: {formatValue(parseFloat(filterAmountMin))}</span>
                <X size={12} className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setFilterAmountMin("")} />
              </span>
            )}
            {filterAmountMax && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 shadow-3xs">
                <span>Trị giá đến: {formatValue(parseFloat(filterAmountMax))}</span>
                <X size={12} className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setFilterAmountMax("")} />
              </span>
            )}

            <button
              onClick={resetFilters}
              className="text-[11px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 px-2 py-1 rounded-md transition-colors border border-rose-100 cursor-pointer ml-auto"
            >
              {locale === "vi" ? "Xóa tất cả" : "Reset all"}
            </button>
          </div>
        )}

        {/* 5. Bulk Actions Floating bar */}
        <OrderBulkActionBar
          selectedCount={selectedOrderIds.length}
          canCompleteOrder={canCompleteOrder}
          locale={locale}
          onComplete={handleBulkComplete}
          onCancel={() => setBulkCancelOpen(true)}
          onArchive={() => executeBulkAction("archive")}
          onClear={() => setSelectedOrderIds([])}
        />

        {/* 6. Content Section - Responsive Views (Flex-1 avoids parent overflow-x scroll) */}
        <div className="flex-1 min-h-[350px] overflow-hidden">
          {orderQuery.connected && orderQuery.loading && flatOrders.length === 0 ? (
            <ListStatePanel kind="loading" title={locale === "vi" ? "Đang tải danh sách đơn hàng" : "Loading orders from backend"} action={<button type="button" onClick={orderQuery.cancel} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">{locale === "vi" ? "Hủy" : "Cancel"}</button>} />
          ) : orderQuery.connected && orderQuery.error && flatOrders.length === 0 ? (
            <ListStatePanel kind="error" title={locale === "vi" ? "Không thể tải danh sách đơn hàng" : "Order list could not be loaded"} action={<button type="button" onClick={() => void orderQuery.refresh()} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold">{locale === "vi" ? "Thử lại" : "Retry"}</button>} />
          ) : filteredOrders.length === 0 ? (
            <ListStatePanel
              kind="empty"
              title={flatOrders.length === 0 ? tx("orders.empty.noOrders", "Chưa có đơn hàng") : tx("orders.empty.noFilteredOrders", "Không có đơn hàng phù hợp")}
              action={canCreateOrder ? <button type="button" onClick={() => navigate(path("orders/new"))} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700">{locale === "vi" ? "Tạo đơn hàng" : "Create order"}</button> : undefined}
            />
          ) : (
            <>
              {/* TABLE VIEW DISPLAY */}
              {view === "table" && (
                <OrderTable
                  orders={pagination.pageItems}
                  selectedOrderIds={selectedOrderIds}
                  columnConfig={columnConfig}
                  columnDefs={ALL_COLUMN_DEFS}
                  locale={locale}
                  activeMoreActionsOrderId={selectedOrder?.id}
                  onSelectAll={toggleSelectCurrentPage}
                  onSelectOrder={toggleSelectOrder}

                  onMoreActions={(order, el) => {
                    setOrderMenuAnchorEl(el);
                    setSelectedOrder(order);
                  }}
                />
              )}

              {/* CARD DISPLAY - Optimized card-first responsive view layout */}
              {view === "card" && (
                <OrderCardList
                  orders={pagination.pageItems}
                  selectedOrderIds={selectedOrderIds}
                  locale={locale}
                  activeMoreActionsOrderId={selectedOrder?.id}
                  renderStatusBadge={getStatusBadge}
                  renderPaymentBadge={getPaymentBadge}
                  getPaymentState={getPaymentState}
                  formatDate={formatDate}
                  formatValue={formatValue}
                  onSelectOrder={toggleSelectOrder}
                  onViewOrder={(id) => navigate(path(`orders/${id}`))}

                  onMoreActions={(order, el) => {
                    setOrderMenuAnchorEl(el);
                    setSelectedOrder(order);
                  }}
                />
              )}

              {/* KANBAN VIEW grouped by Order status (HTML5 drag Drop, local custom configs columns) */}
              {view === "kanban" && (
                <OrderKanbanBoard
                  orders={filteredOrders}
                  statusConfigs={statusConfigs}
                  locale={locale}
                  activeMoreActionsOrderId={selectedOrder?.id}
                  renderPaymentBadge={getPaymentBadge}
                  getPaymentState={getPaymentState}
                  formatDate={formatDate}
                  formatValue={formatValue}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onViewOrder={(id) => navigate(path(`orders/${id}`))}
                  onMoreActions={(order, el) => {
                    setOrderMenuAnchorEl(el);
                    setSelectedOrder(order);
                  }}
                />
              )}
            </>
          )}
          {filteredOrders.length > 0 && view !== "kanban" ? (
            <ListPaginationBar {...pagination} itemLabelVi="đơn hàng" itemLabelEn="orders" />
          ) : null}
        </div>

      {/* 7. Statistics Drawer Backdrop & Interface */}
      <OrderStatisticsDrawer
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        title={tx("orders.stats.title", "Order statistics")}
        locale={locale}
        stats={stats}
        getStatusLabel={getStatusLabel}
        formatValue={formatValue}
      />


      {/* 9. Column Settings Checklist Custom Modal */}
      <OrderColumnSettingsModal
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        locale={locale}
        columnConfig={columnConfig}
        onSave={handleSaveOrderColumns}
        onReset={handleResetOrderColumns}
      />


      {selectedOrder && (
        <ActionDropdown
          isOpen={!!selectedOrder}
          anchorRef={orderMenuAnchorEl}
          onClose={() => {
            setSelectedOrder(null);
            setOrderMenuAnchorEl(null);
          }}
          sections={getOrderDropdownSections(selectedOrder)}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => { setCancelTarget(null); setCancelReason(""); }}
        onConfirm={confirmOrderCancellation}
        title={locale === "vi" ? "Hủy đơn hàng" : "Cancel order"}
        message={<div className="space-y-3 text-left"><p>{cancelTarget ? `${cancelTarget.orderNumber} sẽ được đánh dấu Đã hủy và không thể tiếp tục giao hàng. Lịch sử giao dịch vẫn được giữ lại.` : ""}</p><textarea autoFocus rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder={locale === "vi" ? "Nhập lý do hủy" : "Cancellation reason"} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></div>}
        confirmText={locale === "vi" ? "Hủy đơn hàng" : "Cancel order"}
        cancelText={locale === "vi" ? "Quay lại" : "Back"}
        variant="danger"
      />
      <ConfirmDialog
        isOpen={bulkCancelOpen}
        onClose={() => setBulkCancelOpen(false)}
        onConfirm={() => { executeBulkAction("cancel"); setBulkCancelOpen(false); }}
        title={locale === "vi" ? "Hủy các đơn hàng đã chọn" : "Cancel selected orders"}
        message={locale === "vi" ? "Chỉ các đơn hàng đã xác nhận mới được hủy. Những đơn đã hoàn tất hoặc đã hủy sẽ được bỏ qua." : "Only confirmed orders will be cancelled. Completed or cancelled orders will be skipped."}
        confirmText={locale === "vi" ? "Hủy đơn" : "Cancel orders"}
        cancelText={locale === "vi" ? "Quay lại" : "Back"}
        variant="danger"
      />
    </ListPageFrame>
  );

}
