import React, { useMemo, useState } from "react";
import { Download, Landmark, ReceiptText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlatformState } from "@/platform/application-state";
import { toWorkspacePath } from "@/platform/navigation";
import { PageHeaderActions } from "@/components/crm/PageHeaderActions";
import { ListDataTable, ListFilterGrid, ListFilterPopover, ListPageFrame, ListPageHeader, ListPaginationBar, ListRecordIdentity, ListStatePanel, ListTableBody, ListTableCell, ListTableHead, ListTableHeaderCell, ListTableRow, ListTableSurface, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import { Badge, Modal, Select } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { addMoney, formatMoneyDto, money } from "@/shared/money";
import { useReceivablesWorkspaceQuery } from "../hooks/useInvoiceVerticalSlice";
import { resolveBuyerPresentation } from "../model/buyerPresentation";
import { SettlementBadge } from "./invoicePresentation";

const agingOptions = ["ALL", "NOT_DUE", "CURRENT", "1_30", "31_60", "61_90", "90_PLUS"] as const;

export const ReceivablesPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { activeWorkspace } = usePlatformState();
  const access = useEffectiveAccess();
  const receivablesQuery = useReceivablesWorkspaceQuery();
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<(typeof agingOptions)[number]>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [showStats, setShowStats] = useState(false);
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const path = (value: string) => toWorkspacePath(activeWorkspace.workspaceKey, "crm", value);
  const all = receivablesQuery.data?.entries ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const rows = useMemo(() => all
    .filter((item) => bucket === "ALL" || item.agingBucket === bucket)
    .filter((item) => {
      if (!normalizedSearch) return true;
      const buyer = resolveBuyerPresentation(item.buyerRef, item.buyerName);
      return [item.invoiceNumber, buyer.searchBlob].some((value) => value.toLowerCase().includes(normalizedSearch));
    }), [all, normalizedSearch, bucket]);
  const pagination = useListPagination(rows, 25);
  const currencies = [...new Set(all.map((item) => item.outstandingAmount.currency))];
  const summaryCurrency = currencies.length === 1 ? currencies[0] : "VND";
  const sum = (predicate: (item: typeof all[number]) => boolean) => all
    .filter(predicate)
    .reduce((total, item) => item.outstandingAmount.currency === summaryCurrency ? addMoney(total, item.outstandingAmount) : total, money("0", summaryCurrency));
  const totalOutstanding = sum(() => true);
  const overdueOutstanding = sum((item) => item.settlementState === "OVERDUE");
  const openCount = all.filter((item) => !["PAID", "CREDITED"].includes(item.settlementState)).length;
  const formatDate = (value?: string) => value
    ? new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
    : "—";
  const bucketLabel = (value: string) => ({
    ALL: text("Tất cả tuổi nợ", "All aging buckets"),
    NOT_DUE: text("Chưa đến hạn", "Not due"),
    CURRENT: text("Đến hạn hiện tại", "Current"),
    "1_30": text("Quá hạn 1–30 ngày", "1–30 days overdue"),
    "31_60": text("Quá hạn 31–60 ngày", "31–60 days overdue"),
    "61_90": text("Quá hạn 61–90 ngày", "61–90 days overdue"),
    "90_PLUS": text("Quá hạn trên 90 ngày", "Over 90 days overdue"),
  })[value] ?? value;

  const exportCsv = () => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["invoiceNumber", "buyerName", "customerCode", "buyerRelationshipId", "issueDate", "dueDate", "currency", "originalAmount", "allocatedAmount", "creditedAmount", "outstandingAmount", "settlementState", "agingBucket"];
    const lines = [header.join(","), ...rows.map((item) => {
      const buyer = resolveBuyerPresentation(item.buyerRef, item.buyerName);
      return [item.invoiceNumber, buyer.displayName, buyer.customerCode, buyer.relationshipId, item.issueDate, item.dueDate, item.outstandingAmount.currency, item.originalAmount.amount, item.allocatedAmount.amount, item.creditedAmount.amount, item.outstandingAmount.amount, item.settlementState, item.agingBucket].map(escape).join(",");
    })];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `receivables-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ListPageFrame id="receivables-list-page">
      <ListPageHeader
        title={text("Công nợ phải thu", "Receivables")}
        count={rows.length}
        icon={<Landmark size={18} />}
        actions={access.can(CAPABILITIES.RECEIVABLES_EXPORT) ? (
          <PageHeaderActions actions={[{ id: "export-receivables", label: text("Xuất báo cáo", "Export"), icon: <Download size={14} />, onClick: exportCsv, variant: "secondary" }]} />
        ) : undefined}
      />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={text("Tìm tên khách hàng, mã KH hoặc số hóa đơn...", "Search customer name, customer code, or invoice...")}
        viewMode={viewMode}
        onViewModeChange={(value) => setViewMode(value as "table" | "card")}
        viewOptions={[
          { value: "table", label: text("Dạng bảng", "Table view") },
          { value: "card", label: text("Dạng thẻ", "Card view") },
        ]}
        showStats
        onOpenStats={() => setShowStats(true)}
        statsLabel={text("Thống kê", "Statistics")}
        showFilters
        onOpenFilters={() => setFilterOpen((open) => !open)}
        onCloseFilters={() => setFilterOpen(false)}
        filtersOpen={filterOpen}
        filtersLabel={text("Bộ lọc", "Filters")}
        activeFilterCount={bucket === "ALL" ? 0 : 1}
        hasActiveFilters={bucket !== "ALL"}
        filtersPanel={(
          <ListFilterPopover
            isOpen={filterOpen}
            onClose={() => setFilterOpen(false)}
            onReset={() => setBucket("ALL")}
            ariaLabel={text("Bộ lọc công nợ", "Receivables filters")}
            resetLabel={text("Đặt lại", "Reset")}
            doneLabel={text("Hoàn tất", "Done")}
          >
            <ListFilterGrid>
              <Select
                label={text("Tuổi nợ", "Aging bucket")}
                value={bucket}
                onChange={(event) => setBucket(event.target.value as (typeof agingOptions)[number])}
              >
                {agingOptions.map((value) => <option key={value} value={value}>{bucketLabel(value)}</option>)}
              </Select>
            </ListFilterGrid>
          </ListFilterPopover>
        )}
      />

      {receivablesQuery.loading && !receivablesQuery.data ? (
        <ListStatePanel kind="loading" title={text("Đang tải công nợ", "Loading receivables")} action={<button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={receivablesQuery.cancel}>{text("Hủy", "Cancel")}</button>} />
      ) : receivablesQuery.state === "ERROR" && !receivablesQuery.data ? (
        <ListStatePanel kind="error" title={text("Không thể tải công nợ", "Receivables could not be loaded")} action={<button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={() => void receivablesQuery.refresh()}>{text("Thử lại", "Retry")}</button>} />
      ) : rows.length === 0 ? (
        <ListStatePanel kind="empty" title={text("Không có công nợ phù hợp", "No matching receivables")} />
      ) : (
        <>
          <div className={viewMode === "card" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "grid gap-3 md:hidden"}>
            {pagination.pageItems.map((item) => {
              const buyer = resolveBuyerPresentation(item.buyerRef, item.buyerName);
              return (
                <article key={item.invoiceId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <ListRecordIdentity avatar={<ReceiptText size={15} />} primary={item.invoiceNumber} secondary={buyer.displayName} tertiary={buyer.customerCode ? `${text("Mã KH", "Customer code")}: ${buyer.customerCode}` : buyer.relationshipId} onOpen={() => navigate(path(`receivables/${item.invoiceId}`))} />
                    <SettlementBadge state={item.settlementState} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-[11px]">
                    <div><span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">{text("Hạn", "Due")}</span><strong className="mt-1 block text-slate-800">{formatDate(item.dueDate)}</strong></div>
                    <div><span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">{text("Tuổi nợ", "Aging")}</span><strong className="mt-1 block text-slate-800">{bucketLabel(item.agingBucket)}</strong></div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
                    <button type="button" className="text-[10px] font-semibold text-indigo-600 hover:underline" onClick={() => navigate(path(`receivables/accounts/${item.buyerRef.id}`))}>{text("Mở sao kê", "Open statement")}</button>
                    <div className="text-right"><span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">{text("Còn phải thu", "Outstanding")}</span><strong className="mt-1 block text-sm text-slate-950">{formatMoneyDto(item.outstandingAmount, locale === "vi" ? "vi-VN" : "en-US")}</strong></div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={viewMode === "table" ? "hidden md:block" : "hidden"}>
            <ListTableSurface surfaceId="receivables">
              <ListDataTable minWidth={1120}>
                <ListTableHead>
                  <tr>
                    <ListTableHeaderCell>{text("Hóa đơn", "Invoice")}</ListTableHeaderCell>
                    <ListTableHeaderCell>{text("Khách hàng", "Buyer")}</ListTableHeaderCell>
                    <ListTableHeaderCell>{text("Hạn / Tuổi nợ", "Due / Aging")}</ListTableHeaderCell>
                    <ListTableHeaderCell align="right">{text("Giá trị gốc", "Original")}</ListTableHeaderCell>
                    <ListTableHeaderCell align="right">{text("Đã phân bổ", "Allocated")}</ListTableHeaderCell>
                    <ListTableHeaderCell align="right">{text("Đã ghi giảm", "Credited")}</ListTableHeaderCell>
                    <ListTableHeaderCell align="right">{text("Còn phải thu", "Outstanding")}</ListTableHeaderCell>
                    <ListTableHeaderCell align="center">{text("Trạng thái", "State")}</ListTableHeaderCell>
                  </tr>
                </ListTableHead>
                <ListTableBody>
                  {pagination.pageItems.map((item) => {
                    const buyer = resolveBuyerPresentation(item.buyerRef, item.buyerName);
                    return (
                      <ListTableRow key={item.invoiceId}>
                        <ListTableCell><ListRecordIdentity avatar={<ReceiptText size={15} />} primary={item.invoiceNumber} secondary={item.invoiceId} onOpen={() => navigate(path(`receivables/${item.invoiceId}`))} /></ListTableCell>
                        <ListTableCell>
                          <div className="font-semibold text-slate-800">{buyer.displayName}</div>
                          <div className="mt-0.5 text-[10px] text-slate-400">{buyer.subtitle}</div>
                          <button type="button" className="mt-1 text-[10px] font-semibold text-indigo-600 hover:underline" onClick={() => navigate(path(`receivables/accounts/${item.buyerRef.id}`))}>{text("Sao kê tài khoản", "Account statement")}</button>
                        </ListTableCell>
                        <ListTableCell><div className="font-medium text-slate-700">{formatDate(item.dueDate)}</div><Badge variant={item.settlementState === "OVERDUE" ? "danger" : "neutral"} className="mt-1">{bucketLabel(item.agingBucket)}</Badge></ListTableCell>
                        <ListTableCell align="right" className="whitespace-nowrap">{formatMoneyDto(item.originalAmount, locale === "vi" ? "vi-VN" : "en-US")}</ListTableCell>
                        <ListTableCell align="right" className="whitespace-nowrap text-emerald-700">{formatMoneyDto(item.allocatedAmount, locale === "vi" ? "vi-VN" : "en-US")}</ListTableCell>
                        <ListTableCell align="right" className="whitespace-nowrap text-sky-700">{formatMoneyDto(item.creditedAmount, locale === "vi" ? "vi-VN" : "en-US")}</ListTableCell>
                        <ListTableCell align="right" className="whitespace-nowrap font-semibold text-slate-950">{formatMoneyDto(item.outstandingAmount, locale === "vi" ? "vi-VN" : "en-US")}</ListTableCell>
                        <ListTableCell align="center"><SettlementBadge state={item.settlementState} /></ListTableCell>
                      </ListTableRow>
                    );
                  })}
                </ListTableBody>
              </ListDataTable>
            </ListTableSurface>
          </div>
          <ListPaginationBar {...pagination} itemLabelVi="khoản công nợ" itemLabelEn="receivables" />
        </>
      )}
      <Modal
        id="receivables-statistics-modal"
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        size="lg"
        title={text("Thống kê công nợ", "Receivables statistics")}
        description={text("Tổng hợp số dư từ hóa đơn, phân bổ và Credit Note có hiệu lực.", "Balance summary from invoices, allocations, and effective credit notes.")}
        bodyClassName="bg-slate-50/70"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            [text("Tổng còn phải thu", "Total outstanding"), formatMoneyDto(totalOutstanding, locale === "vi" ? "vi-VN" : "en-US"), text("Theo hóa đơn đã phát hành", "From issued invoices")],
            [text("Quá hạn", "Overdue"), formatMoneyDto(overdueOutstanding, locale === "vi" ? "vi-VN" : "en-US"), text("Cần ưu tiên thu hồi", "Collection priority")],
            [text("Hóa đơn đang mở", "Open invoices"), String(openCount), text("Chưa tất toán hoặc ghi giảm đủ", "Not fully settled or credited")],
          ].map(([label, value, hint]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
              <div className="mt-2 break-words text-xl font-semibold text-slate-950">{value}</div>
              <div className="mt-1 text-xs text-slate-500">{hint}</div>
            </div>
          ))}
        </div>
      </Modal>

    </ListPageFrame>
  );
};
