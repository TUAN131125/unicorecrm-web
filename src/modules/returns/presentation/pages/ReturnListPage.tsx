import { AuthoritativeQueryNotice, formatApplicationError } from "@/shared/operations";
import { useReturnsAuthoritative } from "../hooks/useReturnsAuthoritative";
import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Eye, PackageCheck, PackageOpen, Plus, ShieldCheck, Sparkles, Truck, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { ActionDropdown, type ActionDropdownSection } from "@/components/crm/ActionDropdown";
import { ActionDropdownTrigger } from "@/components/crm/ActionDropdownTrigger";
import { ListBulkActionBar, ListPageFrame, ListPageHeader, ListPaginationBar, ListStatePanel, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import { OperationFilterPopover, OperationFilterGroup, OperationMetricGrid, OperationSavedViews, type OperationSavedViewItem } from "@/components/crm/operations";
import { Button, ConfirmDialog, Modal } from "@/shared/components/ui";
import { getOrderListSnapshot, subscribeToOrderList } from "@/modules/orders";
import type { ReturnRequest } from "../../domain/model/return.types";
import { closeReturnCommand, getReturnStatsSnapshot, getReturnsSnapshot, queryReturnSnapshot, subscribeToReturns } from "../../public/api";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { useSubscribableSnapshot } from "@/platform/react";
import { ReturnStatusBadge } from "../components/ReturnStatusBadge";
import { ReturnTable } from "../list/ReturnTable";
import { resolveReturnActionIds } from "../model/returnActionPolicy";

const views = [
  ["ALL", "Tất cả", "violet"],
  ["INELIGIBLE_REVIEW", "Không đủ điều kiện · cần quyết định", "rose"],
  ["AWAITING_APPROVAL", "Cần duyệt", "amber"],
  ["AWAITING_RETURN_METHOD", "Chưa chọn cách trả hàng", "sky"],
  ["AWAITING_ITEM", "Đang chờ hàng", "sky"],
  ["PARTIALLY_RECEIVED", "Đã nhận một phần", "amber"],
  ["AWAITING_INSPECTION", "Chờ kiểm tra", "amber"],
  ["PENDING_RESOLUTION", "Chờ xử lý", "rose"],
  ["COMPLETED", "Đã hoàn tất", "emerald"],
  ["REJECTED", "Bị từ chối", "slate"],
] as const;
const resolutionLabel: Record<string, string> = {
  REFUND: "Hoàn tiền",
  REPLACEMENT: "Thay thế",
  EXCHANGE: "Đổi hàng",
  REPAIR: "Sửa chữa",
};
const reasonLabel: Record<string, string> = {
  DEFECTIVE: "Lỗi sản phẩm",
  WRONG_ITEM: "Sai hàng",
  DAMAGED: "Hư hỏng",
  CUSTOMER_CHANGED_MIND: "Khách đổi ý",
};
const qty = (request: ReturnRequest) => request.items.reduce((sum, item) => sum + item.requestedQuantity, 0);
const approvedQty = (request: ReturnRequest) => request.items.reduce((sum, item) => sum + (item.approvedQuantity ?? 0), 0);
const receivedQty = (request: ReturnRequest) => request.items.reduce((sum, item) => sum + (item.receivedQuantity ?? 0), 0);
const stageOf = (request: ReturnRequest) => {
  if (request.status === "REQUESTED" && !request.eligibilityResult.eligible) return "INELIGIBLE_REVIEW";
  if (request.status === "REQUESTED") return "AWAITING_APPROVAL";
  if (request.status === "APPROVED" && !request.returnMethod) return "AWAITING_RETURN_METHOD";
  if (request.status === "AWAITING_ITEM" && receivedQty(request) > 0) return "PARTIALLY_RECEIVED";
  if (request.status === "AWAITING_ITEM") return "AWAITING_ITEM";
  if (request.status === "RECEIVED" && !request.inspection) return "AWAITING_INSPECTION";
  if (request.status === "RECEIVED") return "PENDING_RESOLUTION";
  if (["RESOLVED", "CLOSED"].includes(request.status)) return "COMPLETED";
  return request.status;
};

const stageLabel: Record<string, string> = Object.fromEntries(views.map(([key, label]) => [key, label]));

export const ReturnListPage: React.FC = () => {
  const returnQuery = useReturnsAuthoritative();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const access = useEffectiveAccess();
  const reduceMotion = useReducedMotion();
  const snapshot = useSubscribableSnapshot(getReturnsSnapshot, subscribeToReturns);
  const orders = useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("ALL");
  const [reason, setReason] = useState("ALL");
  const [resolution, setResolution] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [showStats, setShowStats] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuRecord, setMenuRecord] = useState<ReturnRequest | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [closeTarget, setCloseTarget] = useState<ReturnRequest | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const records = useMemo(() => queryReturnSnapshot({ search, view, reason, resolution }), [snapshot, search, view, reason, resolution]);
  const stats = useMemo(() => getReturnStatsSnapshot(), [snapshot]);
  const actorId = access.memberId || access.accountId || "current-user";
  const actorName = getAuthSessionSnapshot()?.principal.displayName || actorId;
  const permissions = {
    canView: access.can(CAPABILITIES.RETURNS_READ),
    canApprove: access.can(CAPABILITIES.RETURNS_UPDATE),
    canUpdate: access.can(CAPABILITIES.RETURNS_UPDATE),
    canResolve: access.can(CAPABILITIES.RETURNS_RESOLVE),
  };
  const activeFilterCount = Number(reason !== "ALL") + Number(resolution !== "ALL");

  const pagination = useListPagination(records, 25);

  const savedViews = useMemo<OperationSavedViewItem[]>(() => views.map(([key, label, tone]) => ({
    key,
    label,
    tone,
    count: queryReturnSnapshot({ view: key }).length,
  })), [snapshot]);

  const sectionsFor = (request: ReturnRequest): ActionDropdownSection[] => {
    const ids = resolveReturnActionIds(request, permissions);
    const item = (id: (typeof ids)[number]) => ({
      id,
      label: id === "view" ? "Xem chi tiết" : id === "approve" ? "Duyệt yêu cầu" : id === "reject" ? "Từ chối yêu cầu" : id === "create-pickup" ? "Thiết lập cách trả hàng" : id === "receive" ? "Xác nhận hàng thực nhận" : id === "resolve" ? "Xử lý yêu cầu" : "Đóng yêu cầu",
      icon: id === "view" ? <Eye size={14} /> : id === "approve" ? <ShieldCheck size={14} /> : id === "reject" ? <XCircle size={14} /> : id === "create-pickup" ? <PackageCheck size={14} /> : <CheckCircle2 size={14} />,
      destructive: id === "reject",
      onClick: () => id === "close" ? setCloseTarget(request) : navigate(request.id),
    });
    return [
      { id: "access", items: ids.filter((id) => id === "view").map(item) },
      { id: "workflow", title: "NGHIỆP VỤ", items: ids.filter((id) => id !== "view").map(item) },
    ];
  };

  const confirmClose = () => {
    if (!closeTarget) return;
    try {
      closeReturnCommand(closeTarget.id, { actorId, actorName });
      setMessage("Đã đóng yêu cầu đổi / trả. Kết quả kiểm tra hàng và toàn bộ lịch sử xử lý vẫn được lưu.");
      setCloseTarget(null);
    } catch (error) {
      setMessage(formatApplicationError(error, { locale }));
    }
  };

  const toggleSelection = (id: string, checked: boolean) => setSelectedIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  const selectedRows = records.filter((item) => selectedIds.includes(item.id));

  return (
    <><AuthoritativeQueryNotice connected={returnQuery.connected} loading={returnQuery.loading} refreshing={returnQuery.refreshing} stale={returnQuery.stale} loadedAt={returnQuery.loadedAt} error={returnQuery.error} onRefresh={() => void returnQuery.refresh()} compact /><ListPageFrame id="return-list-page" className="text-slate-700">
      <ListPageHeader
        title="Đổi / Trả hàng"
        count={records.length}
        context="Không gian xử lý eligibility, approval, thu hồi, inspection và resolution evidence"
        icon={<PackageOpen size={20} />}
        actions={access.can(CAPABILITIES.RETURNS_UPDATE) ? <Button type="button" actionIntent="create" size="sm" icon={<Plus size={14} />} className="h-9 rounded-xl" onClick={() => navigate("new")}>Tạo yêu cầu</Button> : undefined}
      />

      <AnimatePresence>{message && <motion.div initial={reduceMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs font-medium text-violet-800"><Sparkles size={14} />{message}</motion.div>}</AnimatePresence>

      <OperationSavedViews items={savedViews} activeKey={view} onChange={setView} title="Case queue" />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm Return, Order, khách hàng, lý do..."
        viewMode={viewMode}
        onViewModeChange={(value) => setViewMode(value as "table" | "card")}
        viewOptions={[{ value: "table", label: "Dạng bảng" }, { value: "card", label: "Dạng thẻ" }]}
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
            onReset={() => { setReason("ALL"); setResolution("ALL"); }}
            title="Bộ lọc Đổi / Trả"
            resetLabel="Đặt lại"
            doneLabel="Hoàn tất"
          >
            <OperationFilterGroup label="Lý do đổi / trả">
              <div className="grid grid-cols-2 gap-2">
                {[["ALL", "Tất cả"], ...Object.entries(reasonLabel)].map(([key, label]) => <button key={key} type="button" onClick={() => setReason(key)} className={`rounded-xl border px-3 py-2.5 text-left text-xs font-medium ${reason === key ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-600"}`}>{label}</button>)}
              </div>
            </OperationFilterGroup>
            <OperationFilterGroup label="Phương án mong muốn">
              <div className="grid grid-cols-2 gap-2">
                {[["ALL", "Tất cả"], ...Object.entries(resolutionLabel)].map(([key, label]) => <button key={key} type="button" onClick={() => setResolution(key)} className={`rounded-xl border px-3 py-2.5 text-left text-xs font-medium ${resolution === key ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 text-slate-600"}`}>{label}</button>)}
              </div>
            </OperationFilterGroup>
          </OperationFilterPopover>
        )}
        showStats
        onOpenStats={() => setShowStats(true)}
        statsLabel="Thống kê"
        filtersLabel="Bộ lọc"
      />

      <ListBulkActionBar selectedCount={selectedIds.length} label="Đã chọn" onClear={() => setSelectedIds([])}><Button type="button" actionIntent="navigate" size="sm" onClick={() => selectedRows[0] && navigate(selectedRows[0].id)}>Mở yêu cầu đầu tiên</Button></ListBulkActionBar>

      {records.length === 0 ? (
        <ListStatePanel
          kind="empty"
          title="Không có yêu cầu phù hợp"
        />
      ) : (
        <>
          <div className={viewMode === "card" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4 md:hidden"}>
            {pagination.pageItems.map((request) => {
              const order = orders.find((item) => item.id === request.orderId);
              const approved = approvedQty(request);
              const received = receivedQty(request);
              const receiveProgress = approved > 0 ? Math.min(100, (received / approved) * 100) : 0;
              const stage = stageOf(request);

              return (
                <motion.article
                  layout
                  key={request.id}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button type="button" onClick={() => navigate(request.id)} className="text-sm font-semibold text-slate-950 hover:text-violet-700">
                        {request.code}
                      </button>
                      <div className="mt-1 crm-text-wrap text-xs font-medium text-slate-500">
                        {order?.orderNumber ?? request.orderId} · {order?.customerName ?? request.buyerRef.id}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(request.id)}
                        onChange={(event) => toggleSelection(request.id, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <ActionDropdownTrigger
                        isOpen={menuRecord?.id === request.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuRecord(request);
                          setMenuAnchor(event.currentTarget);
                        }}
                        title={`Thao tác với yêu cầu ${request.code}`}
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Operational stage</div>
                        <div className="mt-1 text-xs font-medium text-slate-900">{stageLabel[stage] ?? stage}</div>
                      </div>
                      <ReturnStatusBadge status={request.status} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] font-medium uppercase text-slate-400">Yêu cầu</div>
                      <div className="mt-1 font-medium text-slate-900">{qty(request)} đơn vị</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium uppercase text-slate-400">Resolution</div>
                      <div className="mt-1 font-medium text-slate-900">
                        {resolutionLabel[request.requestedResolution ?? ""] ?? request.requestedResolution ?? "—"}
                      </div>
                    </div>
                  </div>

                  {approved > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                        <span>Tiến độ nhận hàng</span>
                        <span>{received}/{approved}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${receiveProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-medium">
                    <span className={`rounded-lg px-2 py-1 ${request.eligibilityResult.eligible ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {request.eligibilityResult.eligible ? "Đủ điều kiện" : "Cần override"}
                    </span>
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{reasonLabel[request.reason] ?? request.reason}</span>
                    {request.returnMethod && <span className="rounded-lg bg-sky-50 px-2 py-1 text-sky-700">{request.returnMethod.method}</span>}
                  </div>
                </motion.article>
              );
            })}
          </div>

          <div className={viewMode === "table" ? "hidden md:block" : "hidden"}>
            <ReturnTable
              records={pagination.pageItems}
              orders={orders}
              selectedIds={selectedIds}
              locale={locale}
              activeRecordId={menuRecord?.id}
              onSelect={toggleSelection}
              onOpen={(request) => navigate(request.id)}
              onOpenActions={(request, anchor) => { setMenuRecord(request); setMenuAnchor(anchor); }}
              stageOf={stageOf}
              stageLabel={stageLabel}
              reasonLabel={reasonLabel}
              resolutionLabel={resolutionLabel}
              requestedQuantity={qty}
              approvedQuantity={approvedQty}
              receivedQuantity={receivedQty}
            />
          </div>
        </>
      )}
      {records.length > 0 ? <ListPaginationBar {...pagination} itemLabelVi="yêu cầu đổi trả" itemLabelEn="return requests" /> : null}


      <Modal
        id="return-statistics-modal"
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        size="lg"
        title={text("Thống kê Đổi / Trả hàng", "Return statistics")}
        description={text("Tổng hợp các hồ sơ cần duyệt, nhận hàng và hoàn tất xử lý.", "Summary of cases awaiting approval, receipt, and resolution.")}
        bodyClassName="bg-slate-50/70"
      >
        <OperationMetricGrid items={[
        { key: "total", label: "Tổng hồ sơ", value: stats.total, hint: "Tất cả hồ sơ đổi / trả đang lưu", icon: <PackageOpen size={17} />, tone: "violet" },
        { key: "action", label: "Cần xử lý", value: stats.actionRequired, hint: "Hồ sơ đang chờ quyết định", icon: <AlertTriangle size={17} />, tone: stats.actionRequired > 0 ? "rose" : "slate" },
        { key: "requested", label: "Chờ duyệt", value: stats.requested, hint: "Điều kiện và phê duyệt", icon: <ShieldCheck size={17} />, tone: stats.requested > 0 ? "amber" : "slate", onClick: () => setView("AWAITING_APPROVAL") },
        { key: "awaiting", label: "Đang chờ hàng", value: stats.awaitingItem, hint: "Thu hồi hoặc chờ nhận", icon: <Truck size={17} />, tone: "sky", onClick: () => setView("AWAITING_ITEM") },
        { key: "received", label: "Chờ xử lý", value: stats.received, hint: "Kiểm tra hàng hoặc xử lý", icon: <ClipboardCheck size={17} />, tone: stats.received > 0 ? "amber" : "slate" },
        { key: "resolved", label: "Hoàn tất", value: stats.resolved, hint: "Đã có đủ bằng chứng", icon: <CheckCircle2 size={17} />, tone: "emerald", onClick: () => setView("COMPLETED") },
      ]} />
      </Modal>


      {menuRecord && <ActionDropdown isOpen anchorRef={menuAnchor} onClose={() => { setMenuRecord(null); setMenuAnchor(null); }} sections={sectionsFor(menuRecord)} width={280} />}
      <ConfirmDialog isOpen={Boolean(closeTarget)} onClose={() => setCloseTarget(null)} onConfirm={confirmClose} title="Đóng yêu cầu đổi / trả" message={closeTarget ? `Yêu cầu ${closeTarget.code} sẽ được đóng. Kết quả kiểm tra hàng và toàn bộ lịch sử xử lý vẫn được lưu.` : undefined} confirmText="Đóng yêu cầu" cancelText="Tiếp tục xử lý" variant="warning" />
    </ListPageFrame>
  </>);
};
