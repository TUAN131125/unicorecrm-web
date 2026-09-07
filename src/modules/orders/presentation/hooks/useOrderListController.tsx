import { formatApplicationError, formatOperationUnavailableError, summarizeBulkCommits, unavailableFeatureMessage, useServerPagedModuleCollection } from "@/shared/operations";
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { CustomerOrder, OrderState } from "../../domain/model/order.types";
import type { PaymentRepositorySnapshot, PaymentSummaryState } from "@/modules/payments";
import { evaluatePaymentFulfillmentGateSnapshot, projectPaymentSummaryFromSnapshot } from "@/modules/payments";
import type { ShippingBooking } from "@/modules/shipping";
import { useOrders } from "../hooks/useOrders";
import { archiveOrderCommandBoundary, archiveOrdersCommandBoundary, duplicateOrderDraftCommand, getOrderPreference, removeOrderPreference, replaceOrderList, setOrderPreference } from "../../public/orders";
import { useI18n } from "@/i18n";
import { evaluateOrderClosingPolicy, executeOrderClosingCommand, isOrderClosingUnavailable } from "@/workflows/order-closing";
import { executeOrderConfirmationCommand } from "@/workflows/order-confirmation";
import { executeOrderCancellationCommand } from "@/workflows/order-cancellation";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { usePlatformState } from "@/platform/application-state";
import { toWorkspacePath } from "@/platform/navigation";
import { useCustomerSnapshots } from "../hooks/useCustomerSnapshots";
import { useOrderListFilters } from "../hooks/useOrderListFilters";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import type { OrderStatusConfig, ColumnConfig, OrderColumnDef } from "../list/orderList.types";

export interface OrderListPageProps {
  quotes?: any[];
  deals?: any[];
  payments: PaymentRepositorySnapshot;
  shippingBookings: ShippingBooking[];
}

export type { OrderStatusConfig, ColumnConfig, OrderColumnDef };

const DEFAULT_STATUS_CONFIGS: OrderStatusConfig[] = [
  { code: "DRAFT", labelVi: "Nháp", labelEn: "Draft", color: "bg-violet-50 text-violet-700 border-violet-100", order: 1, category: "active", isSystem: true, isRequired: true, isActive: true, descriptionVi: "Cam kết thương mại đang được chuẩn bị", descriptionEn: "Commercial commitment is being prepared" },
  { code: "CONFIRMED", labelVi: "Đã xác nhận", labelEn: "Confirmed", color: "bg-sky-50 text-sky-700 border-sky-100", order: 2, category: "active", isSystem: true, isRequired: true, isActive: true, descriptionVi: "Đơn hàng và kế hoạch thanh toán đã được kích hoạt", descriptionEn: "Order and Payment Plan are active" },
  { code: "COMPLETED", labelVi: "Hoàn thành", labelEn: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-100", order: 3, category: "terminal", isSystem: true, isRequired: true, isActive: true, descriptionVi: "Fulfillment đã hoàn tất theo evidence policy", descriptionEn: "Fulfillment completed under evidence policy" },
  { code: "CANCELLED", labelVi: "Đã hủy", labelEn: "Cancelled", color: "bg-slate-100 text-slate-700 border-slate-200", order: 4, category: "terminal", isSystem: true, isRequired: true, isActive: true, descriptionVi: "Hủy nghiệp vụ có lý do và audit", descriptionEn: "Explicit business cancellation with audit" },
];
const DEFAULT_VISIBLE_ORDER_COLUMNS = ["orderNumber", "customer", "contact", "source", "state", "paymentSummary", "grandTotal", "orderDate"] as const;
const DEFAULT_HIDDEN_ORDER_COLUMNS = ["sourceQuote", "sourceDeal", "owner", "productsCount", "completedAt", "createdAt", "updatedAt", "expectedDeliveryDate", "currency"] as const;
const ALL_ORDER_COLUMN_KEYS = [...DEFAULT_VISIBLE_ORDER_COLUMNS, ...DEFAULT_HIDDEN_ORDER_COLUMNS];

function normalizeStoredColumnConfig(value: unknown): ColumnConfig {
  if (!value || typeof value !== "object") {
    return { visibleColumnOrder: [...DEFAULT_VISIBLE_ORDER_COLUMNS], hiddenColumns: [...DEFAULT_HIDDEN_ORDER_COLUMNS] };
  }
  const candidate = value as Partial<ColumnConfig>;
  const visible = Array.isArray(candidate.visibleColumnOrder)
    ? candidate.visibleColumnOrder.filter((key): key is string => typeof key === "string" && ALL_ORDER_COLUMN_KEYS.includes(key as never))
    : [];
  const hidden = Array.isArray(candidate.hiddenColumns)
    ? candidate.hiddenColumns.filter((key): key is string => typeof key === "string" && ALL_ORDER_COLUMN_KEYS.includes(key as never))
    : [];
  const uniqueVisible = [...new Set(visible)];
  if (!uniqueVisible.includes("orderNumber")) uniqueVisible.unshift("orderNumber");
  const uniqueHidden = [...new Set(hidden.filter((key) => !uniqueVisible.includes(key)))];
  for (const key of ALL_ORDER_COLUMN_KEYS) {
    if (!uniqueVisible.includes(key) && !uniqueHidden.includes(key)) uniqueHidden.push(key);
  }
  return { visibleColumnOrder: uniqueVisible, hiddenColumns: uniqueHidden };
}
export function useOrderListController({
  quotes = [],
  deals = [],
  payments,
  shippingBookings,
}: OrderListPageProps) {
  const navigate = useNavigate();
  const { t, locale, tx } = useI18n();
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const baseCurrency = workspaceConfiguration.localeRegion.currencies.baseCurrency;
  const [view, setView] = useState<"table" | "card" | "kanban">(() => {
    const saved = getOrderPreference<string | null>("centrix_order_list_view", null);
    if (saved === "table" || saved === "card" || saved === "kanban") return saved;
    return "table";
  });
  const { orders, query: fullCollectionQuery } = useOrders({ loadAuthoritative: view === "kanban" });
  const customers = useCustomerSnapshots();

  const access = useEffectiveAccess();
  const { session, activeWorkspace } = usePlatformState();
  const path = (value: string) => toWorkspacePath(activeWorkspace.workspaceKey, "crm", value);
  const actorId = session?.principal?.memberId ?? access.memberId ?? "current-user";
  const actorName = session?.principal?.displayName ?? actorId;
  const canCreateOrder = access.canPerform("orders", "create");
  const canConfirmOrder = access.canPerform("orders", "confirm");
  const canCompleteOrder = access.canPerform("orders", "complete");
  const orderActionPermissions = {
    canView: access.canPerform("orders", "read"),
    canUpdate: access.canPerform("orders", "update"),
    canCreate: canCreateOrder,
    canDelete: access.canPerform("orders", "delete"),
    canConfirm: canConfirmOrder,
    canComplete: canCompleteOrder,
    canCreateShipping: access.canPerform("shipping", "create"),
    canRecordPayment: access.can(CAPABILITIES.PAYMENTS_RECORD_MANUAL),
    canCreateInvoice: access.canPerform("invoices", "create"),
  };

  const getPaymentSummary = (order: CustomerOrder) => projectPaymentSummaryFromSnapshot(
    payments,
    order.id,
    order.grandTotal ?? order.totalAmount ?? 0,
    order.currency ?? baseCurrency,
  );
  const getPaymentState = (order: CustomerOrder): PaymentSummaryState => getPaymentSummary(order).state;
  const getShippingForOrder = (order: CustomerOrder) => shippingBookings.filter((booking) => booking.sourceType === "ORDER" && booking.sourceId === order.id);
  const getOrderEvidence = (order: CustomerOrder) => {
    const orderShipping = getShippingForOrder(order);
    return {
      completionReady: evaluateOrderClosingPolicy(order, evaluatePaymentFulfillmentGateSnapshot(payments, order.id, "BEFORE_COMPLETION"), orderShipping).ready,
    };
  };

  // Helper formats
  const formatValue = (val: number, currency = baseCurrency) => {
    return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { style: "currency", currency }).format(val);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  // Drawers/Modals state
  const [showStats, setShowStats] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [activeMenuOrderIds, setActiveMenuOrderIds] = useState<string | null>(null);
  const [orderMenuAnchorEl, setOrderMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CustomerOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);

  // Layout View: Table, Card, Kanban
  // Screen size check to override layout view to card-first on mobile/tablet
  useEffect(() => {
    const saved = getOrderPreference<string | null>("centrix_order_list_view", null);
    if (!saved) {
      const isMobile = window.innerWidth < 768;
      setView(isMobile ? "card" : "table");
    }
  }, []);

  const handleSetView = (newView: "table" | "card" | "kanban") => {
    setView(newView);
    setOrderPreference("centrix_order_list_view", newView);
  };

  // Order lifecycle is canonical domain behavior; the list only projects its labels and colors.
  const statusConfigs = useMemo<OrderStatusConfig[]>(
    () => DEFAULT_STATUS_CONFIGS.map((config) => ({ ...config })),
    [],
  );


  // Column settings preferences state v2
  const [columnConfig, setColumnConfig] = useState<ColumnConfig>(() => {
    const savedV2 = getOrderPreference<unknown>("centrix_order_list_columns_v2", null);
    if (savedV2 !== null) return normalizeStoredColumnConfig(savedV2);
    const savedV1 = getOrderPreference<unknown>("centrix_order_list_columns", null);
    if (Array.isArray(savedV1)) {
      const legacyVisible = [...DEFAULT_VISIBLE_ORDER_COLUMNS, ...savedV1.filter((key): key is string => typeof key === "string")];
      const migrated = normalizeStoredColumnConfig({ visibleColumnOrder: legacyVisible, hiddenColumns: DEFAULT_HIDDEN_ORDER_COLUMNS });
      setOrderPreference("centrix_order_list_columns_v2", migrated);
      return migrated;
    }
    return normalizeStoredColumnConfig(null);
  });

  const saveColumnConfig = (config: ColumnConfig) => {
    // Keep 'orderNumber' in the visible list if not present, as it contains clickable details link
    if (!config.visibleColumnOrder.includes("orderNumber")) {
      config.visibleColumnOrder.unshift("orderNumber");
    }
    setColumnConfig(config);
    setOrderPreference("centrix_order_list_columns_v2", config);
  };

  const resetColumnsToDefault = () => {
    const defaultConfig = { visibleColumnOrder: [...DEFAULT_VISIBLE_ORDER_COLUMNS], hiddenColumns: [...DEFAULT_HIDDEN_ORDER_COLUMNS] };
    setColumnConfig(defaultConfig);
    setOrderPreference("centrix_order_list_columns_v2", defaultConfig);
    removeOrderPreference("centrix_order_list_columns");
  };

  const handleSaveOrderColumns = (visibleColumns: string[]) => {
    const normalizedVisible = ["orderNumber", ...visibleColumns.filter((key) => key !== "orderNumber")]
      .filter((key, index, values) => ALL_ORDER_COLUMN_KEYS.includes(key as (typeof ALL_ORDER_COLUMN_KEYS)[number]) && values.indexOf(key) === index);
    const hiddenColumns = ALL_ORDER_COLUMN_KEYS.filter((key) => !normalizedVisible.includes(key));
    saveColumnConfig({ visibleColumnOrder: normalizedVisible, hiddenColumns });
    setAlertMessage({
      type: "success",
      text: locale === "vi" ? "Đã lưu thiết lập cột giao diện" : "Saved current list configurations successfully.",
    });
  };

  const handleResetOrderColumns = () => {
    resetColumnsToDefault();
    setAlertMessage({
      type: "success",
      text: locale === "vi" ? "Đặt lại cấu trúc cột mặc định" : "Restored default list architecture."
    });
  };


  // Global Alert Message state
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const {
    searchTerm, setSearchTerm,
    filterStatus, setFilterStatus,
    filterPayment, setFilterPayment,
    filterCustomer, setFilterCustomer,
    filterContact, setFilterContact,
    filterOwner, setFilterOwner,
    filterSourceType, setFilterSourceType,
    filterQuoteLinked, setFilterQuoteLinked,
    filterDealLinked, setFilterDealLinked,
    filterDateStart, setFilterDateStart,
    filterDateEnd, setFilterDateEnd,
    filterCompletedStart, setFilterCompletedStart,
    filterCompletedEnd, setFilterCompletedEnd,
    filterAmountMin, setFilterAmountMin,
    filterAmountMax, setFilterAmountMax,
    filterProduct, setFilterProduct,
    flatOrders,
    filteredOrders,
    activeFiltersCount,
    allCustomersList,
    allContactsList,
    allOwnersList,
    allProductsList,
    resetFilters: resetOrderFilters,
  } = useOrderListFilters(orders, payments);

  const deferredOrderSearch = React.useDeferredValue(searchTerm);
  const orderServerQuery = useMemo(() => ({
    search: deferredOrderSearch.trim() || undefined,
    sortBy: "updatedAt",
    sortDirection: "desc" as const,
    filters: {
      state: filterStatus === "all" ? undefined : filterStatus,
    },
  }), [deferredOrderSearch, filterStatus]);
  const serverPagination = useServerPagedModuleCollection<CustomerOrder>({
    key: "orders",
    scopeKey: activeWorkspace.workspaceId,
    enabled: view !== "kanban",
    query: orderServerQuery,
    initialPageSize: 25,
    project: replaceOrderList,
  });
  const query = view === "kanban" ? fullCollectionQuery : serverPagination;

  // Selected Row items
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const resetFilters = () => {
    resetOrderFilters();
    setSelectedOrderIds([]);
  };

  // Status configuration mappings
  const getStatusLabel = (status: OrderState) => {
    const config = statusConfigs.find(c => c.code === status);
    return config ? (locale === "vi" ? config.labelVi : config.labelEn) : status;
  };

  // Order lifecycle commands are explicit; confirmation coordinates Payment Plan activation.
  const executeOrderStateUpdate = async (id: string, nextState: OrderState) => {
    const orderObj = flatOrders.find((order) => order.id === id);
    if (!orderObj) { setAlertMessage({ type: "error", text: locale === "vi" ? "Không tìm thấy đơn hàng" : "Order not found" }); return; }
    if (orderObj.state === nextState) return;

    if (nextState === "CANCELLED") { setCancelTarget(orderObj); setCancelReason(""); return; }
    if (nextState === "CONFIRMED") {
      if (!canConfirmOrder || !access.canAccessRecord("orders", orderObj)) { setAlertMessage({ type: "error", text: locale === "vi" ? "Bạn chưa có quyền xác nhận hoặc Đơn hàng nằm ngoài phạm vi dữ liệu được giao." : "You lack confirmation permission or the Order is outside your assigned data scope." }); return; }
      try {
        await executeOrderConfirmationCommand(
          { orderId: id },
          orderObj.resourceVersion === undefined ? {} : { expectedVersion: orderObj.resourceVersion },
        );
      } catch (error) {
        setAlertMessage({ type: "error", text: formatApplicationError(error, { locale }) });
        return;
      }
      setAlertMessage({ type: "success", text: locale === "vi" ? `Đã xác nhận vận hành ${orderObj.orderNumber} và kích hoạt kế hoạch thanh toán.` : `${orderObj.orderNumber} was operationally confirmed and its Payment Plan activated.` });
      return;
    }
    if (nextState === "COMPLETED") {
      if (orderObj.state !== "CONFIRMED") { setAlertMessage({ type: "error", text: locale === "vi" ? "Chỉ Order CONFIRMED mới có thể hoàn tất." : "Only a CONFIRMED Order can be completed." }); return; }
      if (!canCompleteOrder) { setAlertMessage({ type: "error", text: tx("orders.permission.completeDenied", "You do not have permission to complete orders.") }); return; }
      // WF-12 order-closing is BLOCKED and coordinator-forbidden; refuse on WF-12 first.
      if (isOrderClosingUnavailable()) { setAlertMessage({ type: "error", text: unavailableFeatureMessage({ vi: "Chưa thể hoàn tất đơn hàng", en: "The Order cannot be completed yet" }, { locale }) }); return; }
      const result = (await executeOrderClosingCommand({ orderIds: [id] })).data;
      const blockedItem = result.blocked.find((item) => item.orderId === id);
      if (result.completedIds.includes(id) || result.alreadyCompletedIds.includes(id)) setAlertMessage({ type: "success", text: locale === "vi" ? `Order ${orderObj.orderNumber} đã hoàn tất theo fulfillment evidence.` : `Order ${orderObj.orderNumber} completed from fulfillment evidence.` });
      else setAlertMessage({ type: "error", text: blockedItem?.blockers.join(" ") || "Order completion blocked." });
      return;
    }
    setAlertMessage({ type: "error", text: locale === "vi" ? "Chuyển trạng thái Order không hợp lệ." : "Invalid Order lifecycle transition." });
  };

  const confirmOrderCancellation = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    try {
      await executeOrderCancellationCommand(
        { orderId: cancelTarget.id, reason: cancelReason.trim() },
        cancelTarget.resourceVersion === undefined ? {} : { expectedVersion: cancelTarget.resourceVersion },
      );
    } catch (error) {
      setAlertMessage({ type: "error", text: formatApplicationError(error, { locale }) });
      return;
    }
    setAlertMessage({ type: "success", text: locale === "vi" ? `Đã hủy ${cancelTarget.orderNumber} và đóng kế hoạch thanh toán liên quan.` : `Cancelled ${cancelTarget.orderNumber} and its related Payment Plan.` });
    setCancelTarget(null); setCancelReason("");
  };

  const archiveSingleOrder = async (id: string) => {
    await archiveOrderCommandBoundary(id, { reason: locale === "vi" ? "Lưu trữ từ danh sách Đơn hàng." : "Archived from Order list.", actorId, actorName });
    setAlertMessage({ type: "success", text: locale === "vi" ? "Đã lưu trữ đơn hàng; record nghiệp vụ không bị xóa." : "Order archived without deleting the durable record." });
  };

  /**
   * Duplicating an Order is an authoritative backend operation: `order.duplicate-draft` is
   * PRODUCTION_CONTRACT_READY with its own dedicated Order adapter, and the backend decides
   * the new aggregate's id, number and version. The previous implementation cloned the source
   * Order in the browser and wrote it into the Order projection, which fabricated an
   * authoritative aggregate the backend had never issued.
   */
  const duplicateOrder = async (srcOrder: CustomerOrder) => {
    try {
      const duplicated = (await duplicateOrderDraftCommand(srcOrder.id)).data;
      setAlertMessage({
        type: "success",
        text: locale === "vi"
          ? `Đã nhân bản Order DRAFT ${duplicated.orderNumber} từ ${srcOrder.orderNumber || ""}`
          : `Duplicated DRAFT Order ${duplicated.orderNumber} from ${srcOrder.orderNumber || ""}`,
      });
    } catch (error) {
      setAlertMessage({ type: "error", text: formatOperationUnavailableError(error, {
        locale,
        action: locale === "vi" ? "Nhân bản đơn hàng" : "Duplicating the order",
      }) });
    }
  };

  // Bulk execution
  const executeBulkAction = async (action: "complete" | "cancel" | "archive") => {
    if (selectedOrderIds.length === 0) return;

    if (action === "archive") {
      await archiveOrdersCommandBoundary(selectedOrderIds, { reason: locale === "vi" ? "Lưu trữ hàng loạt từ danh sách Đơn hàng." : "Bulk archived from Order list.", actorId, actorName });
      setAlertMessage({
        type: "success",
        text: locale === "vi" ? "Đã lưu trữ các đơn hàng. Trạng thái nghiệp vụ không thay đổi." : "Archived selected orders without changing business state."
      });
      setSelectedOrderIds([]);
      return;
    }

    if (action === "complete") {
      // WF-12 order-closing is BLOCKED and coordinator-forbidden; refuse on WF-12 first.
      if (isOrderClosingUnavailable()) { setAlertMessage({ type: "error", text: unavailableFeatureMessage({ vi: "Chưa thể hoàn tất đơn hàng", en: "The Orders cannot be completed yet" }, { locale }) }); return; }
      const result = (await executeOrderClosingCommand({ orderIds: selectedOrderIds })).data;
      if (result.blocked.length > 0) {
        setAlertMessage({
          type: "error",
          text: result.blocked.map((item) => `${item.orderId}: ${item.blockers.join(" ")}`).join(" | "),
        });
        return;
      }
    } else {
      // No batch cancellation endpoint exists, so this is one authoritative command per
      // order. Settling per item keeps the outcomes of the orders that already cancelled;
      // reporting both halves is what stops a partial result from reading as a total
      // failure and inviting the user to retry orders that already committed.
      const settled = await Promise.allSettled(selectedOrderIds.map((id) => {
        const order = flatOrders.find((item) => item.id === id);
        return executeOrderCancellationCommand(
          { orderId: id, reason: "Bulk cancellation" },
          order?.resourceVersion === undefined ? {} : { expectedVersion: order.resourceVersion },
        );
      }));
      const bulk = summarizeBulkCommits(selectedOrderIds, settled);
      if (bulk.status !== "FULL_SUCCESS") {
        const failureText = bulk.failed
          .map((entry) => `${entry.id}: ${formatApplicationError(entry.error, { locale })}`)
          .join(" | ");
        setAlertMessage({
          type: "error",
          text: bulk.status === "PARTIAL_SUCCESS"
            ? (locale === "vi"
              ? `Đã hủy ${bulk.committed.length}/${selectedOrderIds.length} đơn hàng. Chưa hủy được: ${failureText}`
              : `Cancelled ${bulk.committed.length} of ${selectedOrderIds.length} orders. Not cancelled: ${failureText}`)
            : (failureText || "Bulk cancellation blocked."),
        });
        // The orders that did cancel stay cancelled; clear only those from the selection so
        // a retry targets what actually remains.
        setSelectedOrderIds((current) => current.filter((id) => !bulk.committed.includes(id)));
        return;
      }
    }

    setAlertMessage({
      type: "success",
      text: locale === "vi"
        ? `Thực thi thao tác hàng loạt thành công!`
        : `Successfully synchronized status for selected orders!`
    });
    setSelectedOrderIds([]);
  };

  const handleBulkComplete = () => {
    if (!canCompleteOrder) {
      setAlertMessage({ type: "error", text: locale === "vi" ? "Bạn không có quyền hoàn tất đơn hàng." : "You do not have permission to complete orders." });
      return;
    }
    executeBulkAction("complete");
  };

  // Select handlers
  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedOrderIds(prev => [...prev, id]);
    }
  };

  // Statistic fields calculation
  const stats = useMemo(() => {
    const totalCount = flatOrders.length;
    const draftCount = flatOrders.filter(o => o.state === "DRAFT").length;
    const confirmedCount = flatOrders.filter(o => o.state === "CONFIRMED").length;
    const processingCount = flatOrders.filter((order) => getShippingForOrder(order).some((booking) => ["WAITING_PICKUP", "PICKED_UP", "IN_TRANSIT"].includes(booking.externalStatus))).length;
    const completedCount = flatOrders.filter(o => o.state === "COMPLETED").length;
    const cancelledCount = flatOrders.filter(o => o.state === "CANCELLED").length;

    const totalValue = flatOrders.reduce((sum, o) => sum + (o.grandTotal || o.totalAmount || 0), 0);
    const completedValue = flatOrders.filter(o => o.state === "COMPLETED").reduce((sum, o) => sum + (o.grandTotal || o.totalAmount || 0), 0);
    const unpaidValue = flatOrders.filter((order) => getPaymentState(order) === "UNPAID").reduce((sum, o) => sum + (o.grandTotal || o.totalAmount || 0), 0);

    const avgValue = totalCount > 0 ? totalValue / totalCount : 0;

    return {
      totalCount,
      draftCount,
      confirmedCount,
      processingCount,
      completedCount,
      cancelledCount,
      totalValue,
      completedValue,
      unpaidValue,
      avgValue
    };
  }, [flatOrders]);

  // Kanban view local Drag and Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetState: OrderState) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) {
      executeOrderStateUpdate(id, targetState);
    }
  };
  return {
    navigate,
    locale,
    tx,
    orders,
    query,
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
  };
}
