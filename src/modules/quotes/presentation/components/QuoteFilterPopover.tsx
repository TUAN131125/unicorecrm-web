import { Input, Select } from "@/shared/components/ui";
import { ListFilterGrid, ListFilterPopover } from "@/components/crm/list-archetype";
import { QuoteStatus } from "../../domain/model/quote.types";

interface QuoteFilterPopoverProps {
  connected?: boolean;
  archiveView: "ACTIVE" | "ARCHIVED" | "ALL";
  setArchiveView(value: "ACTIVE" | "ARCHIVED" | "ALL"): void;
  isOpen: boolean;
  onClose(): void;
  locale: string;
  t(key: string): string;
  filterStatus: string;
  setFilterStatus(value: string): void;
  filterCustomer: string;
  setFilterCustomer(value: string): void;
  uniqueCustomers: Array<{ id: string; name: string }>;
  filterDeal: string;
  setFilterDeal(value: string): void;
  uniqueDeals: Array<{ id: string; name: string }>;
  filterOwner: string;
  setFilterOwner(value: string): void;
  uniqueOwners: string[];
  filterType: string;
  setFilterType(value: string): void;
  filterMinAmount: string;
  setFilterMinAmount(value: string): void;
  filterMaxAmount: string;
  setFilterMaxAmount(value: string): void;
  filterCurrency: string;
  setFilterCurrency(value: string): void;
  currencies: string[];
  filterDate: string;
  setFilterDate(value: string): void;
  clearFilters(): void;
}

export function QuoteFilterPopover({
  connected = false,
  archiveView,
  setArchiveView,
  isOpen,
  onClose,
  locale,
  t,
  filterStatus,
  setFilterStatus,
  filterCustomer,
  setFilterCustomer,
  uniqueCustomers,
  filterDeal,
  setFilterDeal,
  uniqueDeals,
  filterOwner,
  setFilterOwner,
  uniqueOwners,
  filterType,
  setFilterType,
  filterMinAmount,
  setFilterMinAmount,
  filterMaxAmount,
  setFilterMaxAmount,
  filterCurrency,
  setFilterCurrency,
  currencies,
  filterDate,
  setFilterDate,
  clearFilters,
}: QuoteFilterPopoverProps) {
  const isVi = locale === "vi";
  const allLabel = isVi ? "Tất cả" : "All";

  return (
    <ListFilterPopover
      isOpen={isOpen}
      onClose={onClose}
      onReset={clearFilters}
      ariaLabel={t("quotes.list.filters.title")}
      resetLabel={isVi ? "Đặt lại" : "Reset"}
      doneLabel={isVi ? "Hoàn tất" : "Done"}
    >
      {connected && <p className="mb-3 text-xs text-slate-600">{isVi ? "Lọc theo trạng thái và cơ hội liên kết. Các bộ lọc khác chưa được hỗ trợ trên toàn bộ danh sách." : "Filter by status and linked opportunity. Other filters are not yet supported across the full list."}</p>}
      <ListFilterGrid>
        {connected && <Select label={isVi ? "Phạm vi lưu trữ" : "Archive view"} value={archiveView} onChange={event => setArchiveView(event.target.value as "ACTIVE" | "ARCHIVED" | "ALL")}>
          <option value="ACTIVE">{isVi ? "Đang sử dụng" : "Active"}</option>
          <option value="ARCHIVED">{isVi ? "Đã lưu trữ" : "Archived"}</option>
          <option value="ALL">{allLabel}</option>
        </Select>}
        <Select label={t("quotes.list.filters.status")} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
          <option value="">{allLabel}</option>
          <option value={QuoteStatus.DRAFT}>{t("quote.status.draft")}</option>
          <option value={QuoteStatus.REVIEW}>{t("quote.status.review")}</option>
          <option value={QuoteStatus.SENT}>{t("quote.status.sent")}</option>
          <option value={QuoteStatus.ACCEPTED}>{t("quote.status.accepted")}</option>
          <option value={QuoteStatus.REJECTED}>{t("quote.status.rejected")}</option>
          <option value={QuoteStatus.EXPIRED}>{t("quote.status.expired")}</option>
        </Select>

        {!connected && <>
        <Select label={t("quotes.list.filters.customer")} value={filterCustomer} onChange={(event) => setFilterCustomer(event.target.value)}>
          <option value="">{allLabel}</option>
          {uniqueCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </Select>

        </>}
        {connected && <Input label={isVi ? "ID cơ hội liên kết" : "Linked opportunity ID"} value={filterDeal} onChange={event => setFilterDeal(event.target.value.trim())} />}
        <Select label={t("quotes.list.filters.opportunity")} value={filterDeal} onChange={(event) => setFilterDeal(event.target.value)}>
          <option value="">{allLabel}</option>
          {uniqueDeals.map((deal) => <option key={deal.id} value={deal.id}>{deal.name}</option>)}
        </Select>

        {!connected && <>
        <Select label={t("quotes.list.filters.owner")} value={filterOwner} onChange={(event) => setFilterOwner(event.target.value)}>
          <option value="">{allLabel}</option>
          {uniqueOwners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
        </Select>

        <Select label={isVi ? "Hình thức báo giá" : "Quote type"} value={filterType} onChange={(event) => setFilterType(event.target.value)}>
          <option value="">{allLabel}</option>
          <option value="direct">{isVi ? "Báo giá trực tiếp" : "Direct quote"}</option>
          <option value="linked">{isVi ? "Gắn với cơ hội" : "Opportunity-linked"}</option>
        </Select>

        <Select label={isVi ? "Tiền tệ" : "Currency"} value={filterCurrency} onChange={(event) => setFilterCurrency(event.target.value)}>
          <option value="">{isVi ? "Chọn tiền tệ" : "Select currency"}</option>
          {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
        </Select>

        <Input label={isVi ? "Giá trị từ" : "Minimum amount"} type="number" value={filterMinAmount} disabled={!filterCurrency} onChange={(event) => setFilterMinAmount(event.target.value)} inputMode="decimal" />
        <Input label={isVi ? "Giá trị đến" : "Maximum amount"} type="number" value={filterMaxAmount} disabled={!filterCurrency} onChange={(event) => setFilterMaxAmount(event.target.value)} inputMode="decimal" />
        <Input label={isVi ? "Ngày tạo" : "Created date"} type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
        </>}
      </ListFilterGrid>
    </ListFilterPopover>
  );
}
