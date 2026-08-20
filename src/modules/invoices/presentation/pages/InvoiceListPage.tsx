import React, { useMemo, useState } from "react";
import { FilePlus2, FileText, ReceiptText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlatformState } from "@/platform/application-state";
import { toWorkspacePath } from "@/platform/navigation";
import { PageHeaderActions } from "@/components/crm/PageHeaderActions";
import { ListDataTable, ListFilterGrid, ListFilterPopover, ListPageFrame, ListPageHeader, ListPaginationBar, ListRecordIdentity, ListStatePanel, ListTableBody, ListTableCell, ListTableHead, ListTableHeaderCell, ListTableRow, ListTableSurface, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import { Badge, Select } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { formatMoneyDto } from "@/shared/money";
import { useInvoiceWorkspaceQuery } from "../hooks/useInvoiceVerticalSlice";
import { resolveBuyerPresentation } from "../model/buyerPresentation";
import { InvoiceStateBadge } from "./invoicePresentation";

const invoiceStateOptions = ["ALL", "DRAFT", "ISSUED", "ISSUE_FAILED", "VOIDED", "DISCARDED"] as const;

export const InvoiceListPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { activeWorkspace } = usePlatformState();
  const invoiceQuery = useInvoiceWorkspaceQuery();
  const snapshot = invoiceQuery.data ?? { invoices: [], creditNotes: [], deliveries: [] };
  const [search, setSearch] = useState("");
  const [state, setState] = useState<(typeof invoiceStateOptions)[number]>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const path = (value: string) => toWorkspacePath(activeWorkspace.workspaceKey, "crm", value);
  const baseInvoices = useMemo(() => snapshot.invoices
    .filter((invoice) => state === "ALL" || invoice.lifecycleState === state)
    .sort((left, right) => (right.issueDate ?? right.createdAt).localeCompare(left.issueDate ?? left.createdAt)), [snapshot.invoices, state]);
  const normalizedSearch = search.trim().toLowerCase();
  const invoices = useMemo(() => baseInvoices
    .filter((invoice) => {
      if (!normalizedSearch) return true;
      const buyer = resolveBuyerPresentation(invoice.buyerRef, invoice.buyerSnapshot.displayName);
      return [
        invoice.invoiceNumber,
        invoice.id,
        invoice.sourceLinks.orderId,
        buyer.searchBlob,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch));
    }), [baseInvoices, normalizedSearch]);
  const pagination = useListPagination(invoices, 25);
  const formatDate = (value?: string) => value
    ? new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
    : "—";
  const stateLabel = (value: string) => ({
    ALL: text("Tất cả trạng thái", "All states"),
    DRAFT: text("Bản nháp", "Draft"),
    ISSUED: text("Đã phát hành", "Issued"),
    ISSUE_FAILED: text("Phát hành lỗi", "Issue failed"),
    VOIDED: text("Đã hủy hiệu lực", "Voided"),
    DISCARDED: text("Đã loại bỏ", "Discarded"),
  })[value] ?? value;

  return (
    <ListPageFrame id="invoice-list-page">
      <ListPageHeader
        title={text("Hóa đơn", "Invoices")}
        count={invoices.length}
        icon={<FileText size={18} />}
        actions={(
          <PageHeaderActions
            actions={[{
              id: "create-invoice",
              label: text("Tạo hóa đơn nháp", "Create draft invoice"),
              icon: <FilePlus2 size={14} />,
              onClick: () => navigate(path("invoices/new")),
              variant: "primary",
            }]}
          />
        )}
      />

      {invoiceQuery.loading && !invoiceQuery.data && <ListStatePanel kind="loading" title={text("Đang tải hóa đơn", "Loading invoices")} />}
      {invoiceQuery.state === "ERROR" && <ListStatePanel kind="error" title={text("Không thể tải hóa đơn", "Invoices could not be loaded")} action={<button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={() => void invoiceQuery.refresh()}>{text("Thử lại", "Retry")}</button>} />}

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={text("Tìm số hóa đơn, tên khách hàng, mã KH hoặc đơn hàng...", "Search invoice, customer name, customer code, or order...")}
        viewMode={viewMode}
        onViewModeChange={(value) => setViewMode(value as "table" | "card")}
        viewOptions={[
          { value: "table", label: text("Dạng bảng", "Table view") },
          { value: "card", label: text("Dạng thẻ", "Card view") },
        ]}
        showFilters
        onOpenFilters={() => setFilterOpen((open) => !open)}
        onCloseFilters={() => setFilterOpen(false)}
        filtersOpen={filterOpen}
        filtersLabel={text("Bộ lọc", "Filters")}
        activeFilterCount={state === "ALL" ? 0 : 1}
        hasActiveFilters={state !== "ALL"}
        filtersPanel={(
          <ListFilterPopover
            isOpen={filterOpen}
            onClose={() => setFilterOpen(false)}
            onReset={() => setState("ALL")}
            ariaLabel={text("Bộ lọc hóa đơn", "Invoice filters")}
            resetLabel={text("Đặt lại", "Reset")}
            doneLabel={text("Hoàn tất", "Done")}
          >
            <ListFilterGrid>
              <Select
                label={text("Trạng thái hóa đơn", "Invoice state")}
                value={state}
                onChange={(event) => setState(event.target.value as (typeof invoiceStateOptions)[number])}
              >
                {invoiceStateOptions.map((value) => <option key={value} value={value}>{stateLabel(value)}</option>)}
              </Select>
            </ListFilterGrid>
          </ListFilterPopover>
        )}
      />

      {invoices.length === 0 ? (
        <ListStatePanel
          kind="empty"
          title={text("Không có hóa đơn phù hợp", "No matching invoices")}
        />
      ) : (
        <>
          <div className={viewMode === "card" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "grid gap-3 md:hidden"}>
            {pagination.pageItems.map((invoice) => {
              const buyer = resolveBuyerPresentation(invoice.buyerRef, invoice.buyerSnapshot.displayName);
              return (
                <article key={invoice.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <ListRecordIdentity
                      avatar={<ReceiptText size={15} />}
                      primary={invoice.invoiceNumber ?? text("Hóa đơn nháp", "Draft invoice")}
                      secondary={buyer.displayName}
                      tertiary={buyer.customerCode ? `${text("Mã KH", "Customer code")}: ${buyer.customerCode}` : buyer.relationshipId}
                      onOpen={() => navigate(path(`invoices/${invoice.id}`))}
                    />
                    <InvoiceStateBadge state={invoice.lifecycleState} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-[11px]">
                    <div><span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">{text("Ngày phát hành", "Issue date")}</span><strong className="mt-1 block text-slate-800">{formatDate(invoice.issueDate)}</strong></div>
                    <div><span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">{text("Hạn thanh toán", "Due date")}</span><strong className="mt-1 block text-slate-800">{formatDate(invoice.dueDate)}</strong></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-medium text-slate-500">{invoice.sourceLinks.orderId ?? text("Không gắn đơn", "No order")}</span>
                    <strong className="text-sm font-semibold text-slate-950">{formatMoneyDto(invoice.totals.grandTotal, locale === "vi" ? "vi-VN" : "en-US")}</strong>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={viewMode === "table" ? "hidden md:block" : "hidden"}>
            <ListTableSurface surfaceId="invoices">
              <ListDataTable minWidth={980}>
                <ListTableHead>
                  <tr>
                    <ListTableHeaderCell>{text("Hóa đơn", "Invoice")}</ListTableHeaderCell>
                    <ListTableHeaderCell>{text("Khách hàng", "Buyer")}</ListTableHeaderCell>
                    <ListTableHeaderCell>{text("Đơn hàng nguồn", "Source order")}</ListTableHeaderCell>
                    <ListTableHeaderCell>{text("Phát hành / Hạn", "Issue / Due")}</ListTableHeaderCell>
                    <ListTableHeaderCell align="right">{text("Tổng tiền", "Grand total")}</ListTableHeaderCell>
                    <ListTableHeaderCell align="center">{text("Trạng thái", "State")}</ListTableHeaderCell>
                  </tr>
                </ListTableHead>
                <ListTableBody>
                  {pagination.pageItems.map((invoice) => {
                    const buyer = resolveBuyerPresentation(invoice.buyerRef, invoice.buyerSnapshot.displayName);
                    return (
                      <ListTableRow key={invoice.id}>
                        <ListTableCell>
                          <ListRecordIdentity
                            avatar={<ReceiptText size={15} />}
                            primary={invoice.invoiceNumber ?? text("Hóa đơn nháp", "Draft invoice")}
                            secondary={invoice.id}
                            onOpen={() => navigate(path(`invoices/${invoice.id}`))}
                          />
                        </ListTableCell>
                        <ListTableCell>
                          <div className="font-semibold text-slate-800">{buyer.displayName}</div>
                          <div className="mt-0.5 crm-text-wrap text-[10px] text-slate-400">{buyer.subtitle}</div>
                        </ListTableCell>
                        <ListTableCell>
                          {invoice.sourceLinks.orderId ? (
                            <button type="button" onClick={() => navigate(path(`orders/${invoice.sourceLinks.orderId}`))} className="font-semibold text-indigo-600 hover:underline">{invoice.sourceLinks.orderId}</button>
                          ) : <Badge variant="neutral">{text("Không gắn đơn", "No order")}</Badge>}
                        </ListTableCell>
                        <ListTableCell><div className="font-medium text-slate-700">{formatDate(invoice.issueDate)}</div><div className="mt-0.5 text-[10px] text-slate-400">{formatDate(invoice.dueDate)}</div></ListTableCell>
                        <ListTableCell align="right" className="whitespace-nowrap font-semibold text-slate-950">{formatMoneyDto(invoice.totals.grandTotal, locale === "vi" ? "vi-VN" : "en-US")}</ListTableCell>
                        <ListTableCell align="center"><InvoiceStateBadge state={invoice.lifecycleState} /></ListTableCell>
                      </ListTableRow>
                    );
                  })}
                </ListTableBody>
              </ListDataTable>
            </ListTableSurface>
          </div>
          <ListPaginationBar {...pagination} itemLabelVi="hóa đơn" itemLabelEn="invoices" />
        </>
      )}
    </ListPageFrame>
  );
};
