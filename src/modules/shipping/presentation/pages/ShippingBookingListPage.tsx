import { AuthoritativeQueryNotice, formatApplicationError } from "@/shared/operations";
import { createCreateCommandTarget, createProvisionalDocumentNumber } from "@/shared/ids";
import { useShippingAuthoritative } from "../hooks/useShippingAuthoritative";
import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, CheckCircle2, Eye, MapPin, PackageCheck, Plus, RefreshCw, RotateCcw, Route, Sparkles, Truck, WalletCards, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { ActionDropdown, type ActionDropdownSection } from "@/components/crm/ActionDropdown";
import { ActionDropdownTrigger } from "@/components/crm/ActionDropdownTrigger";
import { ListPageFrame, ListPageHeader, ListPaginationBar, ListStatePanel, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import { OperationFilterPopover, OperationFilterGroup, OperationMetricGrid, OperationSavedViews, type OperationSavedViewItem } from "@/components/crm/operations";
import { Button, ConfirmDialog, Modal } from "@/shared/components/ui";
import type { ShippingBooking } from "../../domain/model/shipping.types";
import { cancelShippingBookingCommandBoundary, getShippingKpisSnapshot, getShippingSnapshot, getShippingProviderSnapshot, listShippingProviders, queryShippingSnapshot, retryShippingBookingCommandBoundary, subscribeToShipping } from "../../public/api";
import { useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { getOrderListSnapshot, subscribeToOrderList } from "@/modules/orders";
import { getReturnsSnapshot, subscribeToReturns } from "@/modules/returns";
import { useSubscribableSnapshot } from "@/platform/react";
import { syncShippingAndPaymentCodEvidence } from "@/workflows/shipping-cod-evidence";
import { ShippingBookingStatusBadge, ShippingCarrierStatusBadge } from "../components/ShippingStatusBadges";
import { ShippingBookingTable } from "../list/ShippingBookingTable";
import { resolveShippingActionIds } from "../model/shippingActionPolicy";

const purposeLabel: Record<string, { vi: string; en: string }> = {
  ORDER_OUTBOUND: { vi: "Giao đơn hàng", en: "Order delivery" },
  RETURN_PICKUP: { vi: "Lấy hàng trả", en: "Return pickup" },
  REPLACEMENT_OUTBOUND: { vi: "Giao hàng thay thế", en: "Replacement delivery" },
  RETURN_TO_CUSTOMER: { vi: "Trả hàng về khách", en: "Return to customer" },
};
const views = [
  ["ALL", "Tất cả", "All", "violet"],
  ["NOT_READY", "Thiếu thông tin", "Missing information", "rose"],
  ["ACTION_REQUIRED", "Cần xử lý", "Action required", "amber"],
  ["PENDING_BOOKING", "Chờ gửi yêu cầu", "Pending booking", "sky"],
  ["BOOKING_FAILED", "Không thể tạo yêu cầu", "Booking failed", "rose"],
  ["WAITING_PICKUP", "Chờ lấy hàng", "Waiting for pickup", "sky"],
  ["IN_TRANSIT", "Đang vận chuyển", "In transit", "violet"],
  ["DELIVERY_FAILED", "Giao thất bại", "Delivery failed", "rose"],
  ["DELIVERED", "Đã giao", "Delivered", "emerald"],
  ["RETURNED", "Hoàn hàng", "Returned", "amber"],
  ["SYNC_ERROR", "Cần đồng bộ", "Sync required", "rose"],
  ["COD_RECONCILIATION", "COD cần đối soát", "COD reconciliation", "amber"],
] as const;
const money = (value: string | number, currency = "VND") => `${new Intl.NumberFormat("vi-VN").format(Number(value))} ${currency}`;

export const ShippingBookingListPage: React.FC = () => {
  const shippingQuery = useShippingAuthoritative();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const access = useEffectiveAccess();
  const reduceMotion = useReducedMotion();
  const snapshot = useSubscribableSnapshot(getShippingSnapshot, subscribeToShipping);
  const orders = useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList);
  const returnsSnapshot = useSubscribableSnapshot(getReturnsSnapshot, subscribeToReturns);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("ALL");
  const [providerFilter, setProviderFilter] = useState("ALL");
  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [showStats, setShowStats] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [menuRecord, setMenuRecord] = useState<ShippingBooking | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ShippingBooking | null>(null);
  const records = useMemo(() => queryShippingSnapshot({ search, view, providerId: providerFilter, purpose: purposeFilter }), [snapshot, search, view, providerFilter, purposeFilter]);
  const kpis = useMemo(() => getShippingKpisSnapshot(), [snapshot]);
  const providers = useMemo(() => listShippingProviders(), []);
  const actorId = access.memberId || access.accountId || "current-user";
  const actorName = getAuthSessionSnapshot()?.principal.displayName || actorId;
  const sourceReference = (record: ShippingBooking) => {
    if (record.sourceType === "ORDER") {
      return orders.find((order) => order.id === record.sourceId)?.orderNumber ?? text("Đơn hàng liên quan", "Related order");
    }
    return returnsSnapshot.requests.find((request) => request.id === record.sourceId)?.code ?? text("Yêu cầu đổi / trả liên quan", "Related return request");
  };
  const sourceTypeLabel = (record: ShippingBooking) => record.sourceType === "ORDER" ? text("Đơn hàng", "Order") : text("Đổi / Trả hàng", "Return");
  const groupAttemptCount = (record: ShippingBooking) => {
    const groupId = record.shipmentGroupId;
    return snapshot.filter((item) => item.shipmentGroupId === groupId).length;
  };

  const pagination = useListPagination(records, 25);

  const savedViews = useMemo<OperationSavedViewItem[]>(() => views.map(([key, labelVi, labelEn, tone]) => ({
    key,
    label: locale === "vi" ? labelVi : labelEn,
    tone,
    count: queryShippingSnapshot({ view: key }).length,
  })), [snapshot, locale]);

  const permissions = {
    canView: access.canPerform("shipping", "read"),
    canSync: access.canPerform("shipping", "sync"),
    canRetry: access.canPerform("shipping", "retry"),
    canCancel: access.canPerform("shipping", "cancel"),
  };

  const runAction = async (record: ShippingBooking, action: string) => {
    try {
      if (action === "view") navigate(record.id);
      if (action === "sync") await syncShippingAndPaymentCodEvidence(record.id, { actorId, actorName });
      if (action === "retry") await retryShippingBookingCommandBoundary(record.id, { id: createCreateCommandTarget("shipping"), code: createProvisionalDocumentNumber("SHP"), actorId, actorName });
      if (action === "cancel") setCancelTarget(record);
      if (action !== "view" && action !== "cancel") setMessage(action === "sync" ? "Đã cập nhật trạng thái vận chuyển và thông tin COD liên quan." : "Đã tạo một lần gửi yêu cầu mới trong cùng đợt giao hàng.");
    } catch (error) {
      setMessage(formatApplicationError(error, { locale }));
    }
  };

  const sectionsFor = (record: ShippingBooking): ActionDropdownSection[] => {
    const ids = resolveShippingActionIds(record, permissions, getShippingProviderSnapshot(record.providerId));
    const visibleIds = ids.filter((id) => id !== "change-provider");
    const item = (id: (typeof visibleIds)[number]) => ({
      id,
      label: id === "view" ? "Xem chi tiết" : id === "sync" ? "Đồng bộ đơn vị vận chuyển" : id === "retry" ? "Thử booking lại" : id === "label" ? "Tải nhãn" : "Hủy vận đơn",
      icon: id === "view" ? <Eye size={14} /> : id === "sync" ? <RefreshCw size={14} /> : id === "retry" ? <RotateCcw size={14} /> : id === "label" ? <PackageCheck size={14} /> : <XCircle size={14} />,
      destructive: id === "cancel",
      onClick: () => { if (id === "label") { const blob = new Blob([`LABEL\n${record.code}\n${record.recipientSnapshot.name}`], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${record.code}-label.txt`; anchor.click(); URL.revokeObjectURL(url); return; } void runAction(record, id); },
    });
    return [
      { id: "access", items: visibleIds.filter((id) => id === "view").map(item) },
      { id: "workflow", title: "NGHIỆP VỤ", items: visibleIds.filter((id) => id !== "view").map(item) },
    ];
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelShippingBookingCommandBoundary(cancelTarget.id, { reason: "Hủy từ hàng đợi vận hành", actorId, actorName });
      setMessage("Đã hủy giao hàng. Hồ sơ vận đơn và lịch sử các lần thử vẫn được giữ nguyên.");
      setCancelTarget(null);
    } catch (error) {
      setMessage(formatApplicationError(error, { locale }));
    }
  };

  const activeFilterCount = Number(providerFilter !== "ALL") + Number(purposeFilter !== "ALL");

  return (
    <><AuthoritativeQueryNotice connected={shippingQuery.connected} loading={shippingQuery.loading} refreshing={shippingQuery.refreshing} stale={shippingQuery.stale} loadedAt={shippingQuery.loadedAt} error={shippingQuery.error} onRefresh={() => void shippingQuery.refresh()} compact /><ListPageFrame id="shipping-list-page" className="text-slate-700">
      <ListPageHeader
        title={text("Vận đơn", "Shipping")}
        count={records.length}
        context={text("Hàng đợi tạo vận đơn, giao nhận, bằng chứng COD và các lần thử lại", "Booking, delivery, COD evidence, and retry work queue")}
        icon={<Truck size={20} />}
        actions={access.canPerform("shipping", "create") ? <Button type="button" actionIntent="create" size="sm" icon={<Plus size={14} />} className="h-9 rounded-xl" onClick={() => navigate("/shipping/new")}>{text("Tạo vận đơn", "Create shipment")}</Button> : undefined}
      />

      <AnimatePresence>{message && <motion.div initial={reduceMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-medium text-sky-800"><Sparkles size={14} />{message}</motion.div>}</AnimatePresence>

      <OperationSavedViews items={savedViews} activeKey={view} onChange={setView} title={text("Hàng đợi xử lý", "Work queue")} />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={text("Tìm mã vận đơn, mã theo dõi, đơn hàng, người nhận...", "Search shipment, tracking, order, or recipient...")}
        viewMode={viewMode}
        onViewModeChange={(value) => setViewMode(value as "table" | "card")}
        viewOptions={[{ value: "table", label: text("Dạng bảng", "Table") }, { value: "card", label: text("Dạng thẻ", "Cards") }]}
        showFilters
        activeFilterCount={activeFilterCount}
        hasActiveFilters={activeFilterCount > 0}
        onOpenFilters={() => setFilterOpen((open) => !open)}
        onCloseFilters={() => setFilterOpen(false)}
        filtersOpen={filterOpen}
        filtersPanel={(
          <OperationFilterPopover
            isOpen={filterOpen}
            onClose={() => setFilterOpen(false)}
            onReset={() => { setProviderFilter("ALL"); setPurposeFilter("ALL"); }}
            title={text("Bộ lọc vận đơn", "Shipping filters")}
            resetLabel={text("Đặt lại", "Reset")}
            doneLabel={text("Hoàn tất", "Done")}
          >
            <OperationFilterGroup label={text("Đơn vị vận chuyển", "Carrier")}>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setProviderFilter("ALL")} className={`rounded-xl border px-3 py-2.5 text-left text-xs font-medium ${providerFilter === "ALL" ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-600"}`}>{text("Tất cả đơn vị", "All carriers")}</button>
                {providers.map((provider) => <button key={provider.id} type="button" onClick={() => setProviderFilter(provider.id)} className={`min-w-0 break-words rounded-xl border px-3 py-2.5 text-left text-xs font-medium [overflow-wrap:anywhere] ${providerFilter === provider.id ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-600"}`}>{provider.name}</button>)}
              </div>
            </OperationFilterGroup>
            <OperationFilterGroup label={text("Mục đích vận chuyển", "Shipment purpose")}>
              <div className="grid gap-2">
                {[["ALL", text("Tất cả mục đích", "All purposes")], ...Object.entries(purposeLabel).map(([key, labels]) => [key, labels[locale]])].map(([key, label]) => <button key={key} type="button" onClick={() => setPurposeFilter(key)} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-medium ${purposeFilter === key ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 text-slate-600"}`}><span>{label}</span>{purposeFilter === key && <CheckCircle2 size={14} />}</button>)}
              </div>
            </OperationFilterGroup>
          </OperationFilterPopover>
        )}
        showStats
        onOpenStats={() => setShowStats(true)}
        statsLabel={text("Thống kê", "Statistics")}
        filtersLabel={text("Bộ lọc", "Filters")}
      />

      {records.length === 0 ? <ListStatePanel kind="empty" title={text("Không có vận đơn phù hợp", "No matching shipments")} /> : <>
        <div className={viewMode === "card" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4 md:hidden"}>{pagination.pageItems.map((record) => {
          const readiness = record.readiness?.score ?? 100;
          return <motion.article layout key={record.id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><button type="button" onClick={() => navigate(record.id)} className="text-sm font-semibold text-slate-950 hover:text-sky-700">{record.code}</button><div className="mt-1 crm-text-wrap text-xs font-medium text-slate-500">{record.trackingCode || "Chưa có mã theo dõi"} · {record.providerNameSnapshot}</div></div><ActionDropdownTrigger isOpen={menuRecord?.id === record.id} onClick={(event) => { event.stopPropagation(); setMenuRecord(record); setMenuAnchor(event.currentTarget); }} title={`Thao tác vận đơn ${record.code}`} /></div>
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm"><MapPin size={16} /></div><div className="min-w-0"><div className="crm-text-wrap text-xs font-medium text-slate-900">{record.recipientSnapshot.name}</div><div className="mt-0.5 crm-text-wrap text-[11px] font-medium text-slate-500">{record.recipientSnapshot.phone} · {record.recipientSnapshot.address.city}</div></div></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><div className="text-[10px] font-medium uppercase text-slate-400">{text("Mục đích", "Purpose")}</div><div className="mt-1 font-medium text-slate-800">{purposeLabel[record.purpose]?.[locale] || record.purpose}</div></div><div><div className="text-[10px] font-medium uppercase text-slate-400">{text("Đợt giao hàng", "Shipment attempt")}</div><div className="mt-1 text-[11px] font-medium text-slate-700">{text("Lần", "Attempt")} {record.attemptNo ?? 1}/{groupAttemptCount(record)}</div></div></div>
            <div className="mt-4"><div className="flex items-center justify-between text-[10px] font-medium text-slate-500"><span>Mức độ sẵn sàng</span><span className={readiness >= 85 ? "text-emerald-700" : readiness >= 60 ? "text-amber-700" : "text-rose-700"}>{readiness}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${readiness >= 85 ? "bg-emerald-500" : readiness >= 60 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${readiness}%` }} /></div>{record.readiness?.missingRequired.length ? <div className="mt-2 crm-text-wrap text-[10px] font-medium text-rose-600">Thiếu: {record.readiness.missingRequired.join(" · ")}</div> : null}</div>
            <div className="mt-4 flex flex-wrap items-center gap-2"><ShippingBookingStatusBadge status={record.bookingStatus} /><ShippingCarrierStatusBadge status={record.externalStatus} />{record.codAmount && <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">COD {money(record.codAmount.amount, record.codAmount.currency)}</span>}</div>
          </motion.article>;
        })}</div>

        <div className={viewMode === "table" ? "hidden md:block" : "hidden"}>
          <ShippingBookingTable
            records={pagination.pageItems}
            locale={locale}
            activeRecordId={menuRecord?.id}
            onOpen={(record) => navigate(record.id)}
            onOpenActions={(record, anchor) => { setMenuRecord(record); setMenuAnchor(anchor); }}
            purposeLabel={(record) => purposeLabel[record.purpose]?.[locale] || record.purpose}
            sourceTypeLabel={sourceTypeLabel}
            sourceReference={sourceReference}
            groupAttemptCount={groupAttemptCount}
            formatMoney={money}
          />
        </div>
      </>}
      {records.length > 0 ? <ListPaginationBar {...pagination} itemLabelVi="vận đơn" itemLabelEn="shipments" /> : null}


      <Modal
        id="shipping-statistics-modal"
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        size="lg"
        title={text("Thống kê vận đơn", "Shipping statistics")}
        description={text("Tổng hợp hàng đợi vận hành theo dữ liệu vận đơn hiện tại.", "Operational queue summary from current shipment data.")}
        bodyClassName="bg-slate-50/70"
      >
        <OperationMetricGrid items={[
        { key: "total", label: "Tổng vận đơn", value: kpis.total, hint: "Tất cả các lần giao hàng", icon: <Truck size={17} />, tone: "violet" },
        { key: "action", label: "Cần xử lý", value: kpis.actionRequired, hint: "Hàng đợi ưu tiên", icon: <AlertTriangle size={17} />, tone: kpis.actionRequired > 0 ? "amber" : "slate", onClick: () => setView("ACTION_REQUIRED") },
        { key: "not-ready", label: "Thiếu dữ liệu", value: kpis.notReady, hint: "Thiếu thông tin bắt buộc", icon: <PackageCheck size={17} />, tone: kpis.notReady > 0 ? "rose" : "emerald", onClick: () => setView("NOT_READY") },
        { key: "transit", label: "Đang vận chuyển", value: kpis.inTransit, hint: "Đã lấy hàng hoặc đang vận chuyển", icon: <Route size={17} />, tone: "sky", onClick: () => setView("IN_TRANSIT") },
        { key: "delivered", label: "Giao hôm nay", value: kpis.deliveredToday, hint: "Có bằng chứng thời điểm giao", icon: <CheckCircle2 size={17} />, tone: "emerald", onClick: () => setView("DELIVERED") },
        { key: "cod", label: "COD cần đối soát", value: kpis.codPendingReconciliation, hint: "Đơn vị vận chuyển đã thu, đang chờ xử lý", icon: <WalletCards size={17} />, tone: kpis.codPendingReconciliation > 0 ? "amber" : "slate", onClick: () => setView("COD_RECONCILIATION") },
      ]} />
      </Modal>


      {menuRecord && <ActionDropdown isOpen anchorRef={menuAnchor} onClose={() => { setMenuRecord(null); setMenuAnchor(null); }} sections={sectionsFor(menuRecord)} width={280} />}


      <ConfirmDialog isOpen={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} onConfirm={confirmCancel} title="Hủy giao hàng" message={cancelTarget ? `Lần giao hàng ${cancelTarget.code} sẽ ngừng xử lý. Đơn hàng và toàn bộ lịch sử giao hàng vẫn được giữ lại.` : undefined} confirmText="Hủy giao hàng" cancelText="Tiếp tục giao hàng" variant="danger" />
    </ListPageFrame>
  </>);
};
