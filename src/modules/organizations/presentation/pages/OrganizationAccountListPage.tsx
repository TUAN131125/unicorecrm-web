import React, { useMemo, useState } from "react";
import { Building2, Download, Plus, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeaderActions } from "@/components/crm/PageHeaderActions";
import { Select } from "@/shared/components/ui";
import { ListBulkActionBar, ListFilterGrid, ListFilterPopover, ListPageFrame, ListPageHeader, ListPaginationBar, ListStatePanel, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getOrderListSnapshot, subscribeToOrderList } from "@/modules/orders";
import { useEffectiveAccess } from "@/platform/access-control";
import { AuthoritativeQueryNotice } from "@/shared/operations";
import { useSubscribableSnapshot } from "@/platform/react";
import { OrganizationCardList } from "../list/OrganizationCardList";
import { OrganizationCreateModal } from "../list/OrganizationCreateModal";
import { OrganizationStatisticsDrawer } from "../list/OrganizationStatisticsDrawer";
import { OrganizationTable, type OrganizationListRow } from "../list/OrganizationTable";
import { getOrganizationAccountMetrics, getOrganizationStatus, getPrimaryOrganizationContact } from "../model/organizationAccountView";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";
import { isOrganizationConnectedMode, type OrganizationAccountStatus } from "../../public/api";
import { useOrganizationAccounts } from "../hooks/useOrganizationAccounts";
import { useI18n } from "@/i18n";

export const OrganizationAccountListPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const access = useEffectiveAccess();
  const { accounts, query: organizationQuery } = useOrganizationAccounts();
  const contacts = useSubscribableSnapshot(getContactsSnapshot, subscribeToContacts);
  const deals = useSubscribableSnapshot(getDealsSnapshot, subscribeToDeals);
  const orders = useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList);

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OrganizationAccountStatus>("all");
  const [representativeFilter, setRepresentativeFilter] = useState<"all" | "linked" | "missing">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const actorId = access.memberId || access.accountId || "current-user";
  const connected = isOrganizationConnectedMode();
  const canCreateOrganizationWithRepresentative = access.canPerform("organizations", "create") && access.canPerform("contacts", "create");

  const industries = useMemo(
    () => Array.from(new Set(accounts.map((account) => account.industry).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
    [accounts],
  );
  const sizes = useMemo(
    () => Array.from(new Set(accounts.map((account) => account.sizeBand).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
    [accounts],
  );

  const allRows = useMemo<OrganizationListRow[]>(() => accounts.map((account) => ({
    account,
    primaryContact: getPrimaryOrganizationContact(account, contacts),
    metrics: getOrganizationAccountMetrics(account, contacts, deals, orders),
    ownerName: getWorkspaceMemberOptions().find((user) => user.id === account.ownerId)?.name || account.ownerId || "Chưa phân công",
  })), [accounts, contacts, deals, orders]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRows
      .filter(({ account, primaryContact }) => {
        if (industryFilter !== "all" && account.industry !== industryFilter) return false;
        if (sizeFilter !== "all" && account.sizeBand !== sizeFilter) return false;
        if (statusFilter !== "all" && getOrganizationStatus(account) !== statusFilter) return false;
        if (representativeFilter === "linked" && !primaryContact) return false;
        if (representativeFilter === "missing" && primaryContact) return false;
        if (!term) return true;
        return [
          account.displayName,
          account.legalName,
          account.taxCode,
          account.domain,
          account.website,
          account.industry,
          account.phone,
          account.email,
          primaryContact?.fullName,
          primaryContact?.roleTitle,
          primaryContact?.phone,
          primaryContact?.workEmail,
          primaryContact?.email,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => (b.account.updatedAt || b.account.createdAt).localeCompare(a.account.updatedAt || a.account.createdAt));
  }, [allRows, industryFilter, representativeFilter, search, sizeFilter, statusFilter]);

  const pagination = useListPagination(rows, 25);

  const hasActiveFilters = Boolean(search.trim()) || industryFilter !== "all" || sizeFilter !== "all" || statusFilter !== "all" || representativeFilter !== "all";
  const activeFilterCount = [industryFilter !== "all", sizeFilter !== "all", statusFilter !== "all", representativeFilter !== "all"].filter(Boolean).length;

  const stats = useMemo(() => {
    const industryMap = new Map<string, number>();
    for (const row of allRows) {
      const label = row.account.industry || "Chưa phân ngành";
      industryMap.set(label, (industryMap.get(label) || 0) + 1);
    }
    return {
      totalOrganizations: allRows.length,
      organizationsWithRepresentative: allRows.filter((row) => Boolean(row.primaryContact)).length,
      totalRepresentatives: allRows.reduce((total, row) => total + row.metrics.representativeCount, 0),
      openDealsCount: allRows.reduce((total, row) => total + row.metrics.openDealsCount, 0),
      pipelineValue: allRows.reduce((total, row) => total + row.metrics.pipelineValue, 0),
      orderValue: allRows.reduce((total, row) => total + row.metrics.orderValue, 0),
      industryBreakdown: Array.from(industryMap, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    };
  }, [allRows]);

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id));
  };

  const selectAllVisible = (checked: boolean) => {
    setSelectedIds(checked ? pagination.pageItems.map((row) => row.account.id) : []);
  };

  const resetFilters = () => {
    setSearch("");
    setIndustryFilter("all");
    setSizeFilter("all");
    setStatusFilter("all");
    setRepresentativeFilter("all");
    setSelectedIds([]);
  };

  const exportOrganizations = () => {
    if (connected) {
      setMessage(vi ? "Xuất dữ liệu tổ chức chưa được backend hỗ trợ." : "Organization export is not supported by the backend yet.");
      return;
    }
    const selected = selectedIds.length > 0
      ? allRows.filter((row) => selectedIds.includes(row.account.id))
      : allRows;
    const payload = selected.map((row) => ({
      organization: row.account,
      primaryRepresentative: row.primaryContact,
      metrics: row.metrics,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `unicore-b2b-organizations-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage(`Đã xuất ${selected.length} tổ chức B2B.`);
  };

  return (
    <>
      <AuthoritativeQueryNotice
        connected={organizationQuery.connected}
        loading={organizationQuery.loading}
        refreshing={organizationQuery.refreshing}
        stale={organizationQuery.stale}
        loadedAt={organizationQuery.loadedAt}
        error={organizationQuery.error}
        onRefresh={() => void organizationQuery.refresh()}
        compact
      />
      <ListPageFrame id="organization-account-list-page" className="text-slate-700">
      <ListPageHeader
        title="Tổ chức"
        count={rows.length}
        context="Khách hàng doanh nghiệp B2B · tổ chức và các Contact đại diện"
        icon={<Building2 size={18} />}
        actions={
          <PageHeaderActions
            actions={[
              { id: "create-organization", label: "Thêm tổ chức", icon: <Plus size={14} />, onClick: () => setShowCreate(true), variant: "primary", hidden: !canCreateOrganizationWithRepresentative },
            ]}
          />
        }
      />

      {message && <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-xs font-semibold text-violet-800">{message}</div>}

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={vi ? "Tìm theo tên tổ chức, MST, tên miền hoặc người đại diện..." : "Search by organization, tax code, domain, or representative..."}
        viewMode={viewMode}
        onViewModeChange={(value) => setViewMode(value as "table" | "card")}
        viewOptions={[{ value: "table" as const, label: vi ? "Dạng bảng" : "Table view" }, { value: "card" as const, label: vi ? "Dạng thẻ" : "Card view" }]}
        showFilters
        onOpenFilters={() => setFilterOpen((open) => !open)}
        onCloseFilters={() => setFilterOpen(false)}
        filtersOpen={filterOpen}
        filtersPanel={(
          <ListFilterPopover
            isOpen={filterOpen}
            onClose={() => setFilterOpen(false)}
            onReset={resetFilters}
            ariaLabel={vi ? "Bộ lọc tổ chức" : "Organization filters"}
            resetLabel={vi ? "Đặt lại" : "Reset"}
            doneLabel={vi ? "Hoàn tất" : "Done"}
          >
            <ListFilterGrid>
              <Select label={vi ? "Trạng thái" : "Status"} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option value="all">{vi ? "Tất cả" : "All"}</option><option value="prospect">{vi ? "Tiềm năng" : "Prospect"}</option><option value="active">{vi ? "Đang hoạt động" : "Active"}</option><option value="strategic">{vi ? "Chiến lược" : "Strategic"}</option><option value="inactive">{vi ? "Ngừng hoạt động" : "Inactive"}</option><option value="archived">{vi ? "Lưu trữ" : "Archived"}</option>
              </Select>
              <Select label={vi ? "Người đại diện" : "Representative"} value={representativeFilter} onChange={(event) => setRepresentativeFilter(event.target.value as typeof representativeFilter)}>
                <option value="all">{vi ? "Tất cả" : "All"}</option><option value="linked">{vi ? "Có đại diện chính" : "Has primary representative"}</option><option value="missing">{vi ? "Thiếu đại diện chính" : "Missing primary representative"}</option>
              </Select>
              <Select label={vi ? "Ngành" : "Industry"} value={industryFilter} onChange={(event) => setIndustryFilter(event.target.value)}>
                <option value="all">{vi ? "Tất cả" : "All"}</option>{industries.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
              </Select>
              <Select label={vi ? "Quy mô" : "Size"} value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)}>
                <option value="all">{vi ? "Tất cả" : "All"}</option>{sizes.map((size) => <option key={size} value={size}>{size}</option>)}
              </Select>
            </ListFilterGrid>
          </ListFilterPopover>
        )}
        showColumns={false}
        showStats={true}
        onOpenStats={() => setShowStatistics(true)}
        activeFilterCount={activeFilterCount}
        hasActiveFilters={hasActiveFilters}
        filtersLabel={vi ? "Bộ lọc" : "Filters"}
        statsLabel={vi ? "Thống kê" : "Statistics"}
        rightSlot={<button type="button" onClick={() => void organizationQuery.refresh()} disabled={organizationQuery.refreshing} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-50" title="Làm mới"><RefreshCw size={14} /></button>}
      />

      <ListBulkActionBar selectedCount={selectedIds.length} label="Đã chọn" onClear={() => setSelectedIds([])}>
        {!connected && <button type="button" onClick={exportOrganizations} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-violet-700"><Download size={11} /> Xuất dữ liệu</button>}
      </ListBulkActionBar>

      {rows.length === 0 ? (
        <ListStatePanel
          kind="empty"
          title="Không có tổ chức phù hợp"
          action={canCreateOrganizationWithRepresentative ? <button type="button" onClick={() => setShowCreate(true)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-700">Thêm tổ chức B2B</button> : undefined}
        />
      ) : (
        <>
          {viewMode === "card" ? (
            <OrganizationCardList rows={pagination.pageItems} selectedIds={selectedIds} onSelect={toggleSelection} onOpen={(id) => navigate(id)} />
          ) : (
            <OrganizationTable rows={pagination.pageItems} selectedIds={selectedIds} onSelectAll={selectAllVisible} onSelect={toggleSelection} onOpen={(id) => navigate(id)} />
          )}
          <ListPaginationBar {...pagination} itemLabelVi="tổ chức" itemLabelEn="organizations" />
        </>
      )}

      <OrganizationCreateModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        actorId={actorId}
        onCreated={(account) => {
          setMessage(`Đã tạo tổ chức ${account.displayName} cùng cá nhân đại diện chính.`);
          navigate(account.id);
        }}
      />

      <OrganizationStatisticsDrawer isOpen={showStatistics} onClose={() => setShowStatistics(false)} {...stats} />
      </ListPageFrame>
    </>
  );
};
