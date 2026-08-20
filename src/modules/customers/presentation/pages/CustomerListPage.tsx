import React, { useMemo, useRef, useState } from "react";
import { AuthoritativeQueryNotice } from "@/shared/operations";
import { useCustomers } from "../hooks/useCustomers";
import { AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Archive, Pencil, Plus, RefreshCw, Sparkles, Trash2, Users } from "lucide-react";
import { PageHeaderActions } from "@/components/crm/PageHeaderActions";
import { SavedViewNameModal } from "@/components/crm/SavedViewNameModal";
import { ListBulkActionBar, ListPageFrame, ListPageHeader, ListPaginationBar, ListStatePanel, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import { ConfirmDialog, IconButton } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { archiveCustomerCommand, type Customer } from "../../public/api";
import { useCustomerListFilters } from "../hooks/useCustomerListFilters";
import { useCustomerListViewSettings } from "../hooks/useCustomerListViewSettings";
import { CustomerCardList } from "../list/CustomerCardList";
import { CustomerColumnSettingsDrawer } from "../list/CustomerColumnSettingsDrawer";
import { CustomerFilterPopover } from "../list/CustomerFilterPopover";
import { CustomerSavedViewSelector } from "../list/CustomerSavedViewSelector";
import { CustomerStatisticsPanel, type CustomerStatisticsSummary } from "../list/CustomerStatisticsPanel";
import { CustomerTable } from "../list/CustomerTable";
import { CustomerTopActionMenu } from "../list/CustomerTopActionMenu";
import { ExistingCustomerOnboardingModal } from "../list/ExistingCustomerOnboardingModal";
import { CustomerDataQualityPanel } from "../list/CustomerDataQualityPanel";
import { customerSourceIdentityPath } from "../list/customerList.helpers";
import type { CustomerListPresentationSnapshot, CustomerListRow } from "../list/customerList.types";
import { buildCustomer360ReadModel } from "../model/customer360ReadModel";
import { CUSTOMER_COLUMNS_METADATA } from "../model/customerColumns";
import { captureCustomerPresentationSnapshot, getDefaultCustomerFilters, resolveCustomerPresentationSnapshot } from "../model/customerListPresentationPreferences";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";

interface CustomerListPageProps {
  customers?: Customer[];
  refreshToken?: unknown;
}

export const CustomerListPage: React.FC<CustomerListPageProps> = ({ customers: providedCustomers, refreshToken }) => {
  const customerSource = useCustomers();
  const customers = providedCustomers ?? customerSource.customers;
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const session = getAuthSessionSnapshot();
  const access = useEffectiveAccess();
  const canOnboardExistingCustomer = access.can(CAPABILITIES.CUSTOMERS_ONBOARD_EXISTING);
  const actorId = session?.principal.memberId ?? session?.principal.email ?? "system";
  const actorName = session?.principal.displayName ?? session?.principal.email ?? "CRM User";

  const {
    searchTerm, setSearchTerm,
    typeFilter, setTypeFilter,
    statusFilter, setStatusFilter,
    healthFilter, setHealthFilter,
    ownerFilter, setOwnerFilter,
    segmentFilter, setSegmentFilter,
    nextCareDateFilter, setNextCareDateFilter,
    activeFiltersCount,
    hasActiveFilters,
    resetFilters,
    applyFilterSnapshot,
  } = useCustomerListFilters();

  const {
    activeView,
    isViewDropdownOpen,
    setIsViewDropdownOpen,
    customViews,
    isColumnSettingsOpen,
    setIsColumnSettingsOpen,
    visibleColumns,
    columnWidths,
    selectSavedView,
    createCustomView,
    updateCustomView,
    deleteCustomView,
    saveColumnSettings,
    resetColumnSettings,
    resizeColumn,
    resetColumnWidth,
  } = useCustomerListViewSettings();

  const [viewMode, setViewMode] = useState<"card" | "table">("table");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showStatisticsPanel, setShowStatisticsPanel] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [openRowActionId, setOpenRowActionId] = useState<string | null>(null);
  const [archiveTargets, setArchiveTargets] = useState<CustomerListRow[]>([]);
  const [savedViewDialog, setSavedViewDialog] = useState<{ mode: "create" } | { mode: "edit"; viewKey: string } | null>(null);
  const [viewName, setViewName] = useState("");
  const [viewNameError, setViewNameError] = useState("");
  const [isSavingView, setIsSavingView] = useState(false);
  const [viewToDelete, setViewToDelete] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dataQualityOpen, setDataQualityOpen] = useState(false);
  const viewSaveInFlightRef = useRef(false);

  const rows = useMemo<CustomerListRow[]>(
    () => customers.map((customer) => ({ customer, model: buildCustomer360ReadModel(customer) })),
    [customers, refreshToken],
  );

  const segments = useMemo(() => [...new Set(rows.map((row) => row.customer.segment).filter((value): value is string => Boolean(value)))].sort(), [rows]);
  const today = new Date().toISOString().slice(0, 10);
  const currentUserId = getWorkspaceMemberOptions()[0]?.id;

  const filteredRows = useMemo(() => rows.filter((row) => {
    const { customer, model } = row;
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    const isExplicitArchiveView = activeView === "archived" || statusFilter === "ARCHIVED";
    if (customer.status === "ARCHIVED" && !isExplicitArchiveView) return false;
    if (customer.status !== "ARCHIVED" && activeView === "archived") return false;

    const searchValues = [
      customer.customerCode,
      model.identity.displayName,
      model.identity.email,
      model.identity.phone,
      model.identity.taxCode,
      model.identity.primaryContact?.fullName,
      model.identity.primaryContact?.name,
      model.identity.primaryContact?.workEmail,
      model.identity.primaryContact?.mobilePhone,
      customer.segment,
      ...customer.tags,
    ].filter(Boolean).map((value) => String(value).toLocaleLowerCase());
    if (normalizedSearch && !searchValues.some((value) => value.includes(normalizedSearch))) return false;
    if (typeFilter !== "all" && customer.type !== typeFilter) return false;
    if (statusFilter !== "all" && customer.status !== statusFilter) return false;
    if (healthFilter !== "all" && customer.health !== healthFilter) return false;
    if (ownerFilter !== "all" && (customer.careOwnerId || model.identity.ownerId) !== ownerFilter) return false;
    if (segmentFilter !== "all" && customer.segment !== segmentFilter) return false;
    if (nextCareDateFilter && customer.nextCareAt?.slice(0, 10) !== nextCareDateFilter) return false;

    if (activeView === "myCustomers" && (customer.careOwnerId || model.identity.ownerId) !== currentUserId) return false;
    if (activeView === "b2b" && customer.type !== "B2B") return false;
    if (activeView === "b2c" && customer.type !== "B2C") return false;
    if (activeView === "active" && customer.status !== "ACTIVE") return false;
    if (activeView === "atRisk" && customer.status !== "AT_RISK" && customer.health !== "RISK") return false;
    if (activeView === "needCareToday" && customer.nextCareAt?.slice(0, 10) !== today) return false;
    if (activeView === "overdueCare" && (!customer.nextCareAt || customer.nextCareAt.slice(0, 10) >= today)) return false;
    if (activeView === "openOpportunity" && model.metrics.openDealCount <= 0) return false;
    if (activeView === "openSupport" && model.metrics.openSupportCount <= 0) return false;
    return true;
  }), [activeView, currentUserId, healthFilter, nextCareDateFilter, ownerFilter, rows, searchTerm, segmentFilter, statusFilter, today, typeFilter]);

  const pagination = useListPagination(filteredRows, 25);

  const statistics = useMemo<CustomerStatisticsSummary>(() => {
    const statusCount: Record<string, number> = {};
    const healthCount: Record<string, number> = {};
    rows.forEach((row) => {
      statusCount[row.customer.status] = (statusCount[row.customer.status] || 0) + 1;
      healthCount[row.customer.health] = (healthCount[row.customer.health] || 0) + 1;
    });
    return {
      total: rows.length,
      b2b: rows.filter((row) => row.customer.type === "B2B").length,
      b2c: rows.filter((row) => row.customer.type === "B2C").length,
      active: rows.filter((row) => row.customer.status === "ACTIVE").length,
      atRisk: rows.filter((row) => row.customer.status === "AT_RISK" || row.customer.health === "RISK").length,
      archived: rows.filter((row) => row.customer.status === "ARCHIVED").length,
      revenue: rows.reduce((sum, row) => sum + row.model.metrics.revenue, 0),
      openDeals: rows.reduce((sum, row) => sum + row.model.metrics.openDealCount, 0),
      openWork: rows.reduce((sum, row) => sum + row.model.metrics.openTaskCount, 0),
      openSupport: rows.reduce((sum, row) => sum + row.model.metrics.openSupportCount, 0),
      statusCount,
      healthCount,
    };
  }, [rows]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2600);
  };

  const getCurrentViewSnapshot = (): CustomerListPresentationSnapshot => captureCustomerPresentationSnapshot({
    visibleColumns,
    columnWidths,
    filters: { searchTerm, typeFilter, statusFilter, healthFilter, ownerFilter, segmentFilter, nextCareDateFilter },
    viewMode,
  });

  const applyPresentation = (snapshot?: Partial<CustomerListPresentationSnapshot>) => {
    const resolved = resolveCustomerPresentationSnapshot(snapshot);
    applyFilterSnapshot({ ...getDefaultCustomerFilters(), ...(resolved.filters ?? {}) });
    setViewMode(resolved.viewMode!);
  };

  const handleSelectSavedView = (viewKey: string) => {
    applyPresentation(selectSavedView(viewKey));
    setSelectedCustomerIds([]);
  };

  const activeCustomView = customViews.find((view) => view.key === activeView && !view.isShared);

  const handleAddViewClick = () => {
    setViewName("");
    setViewNameError("");
    setSavedViewDialog({ mode: "create" });
    setIsViewDropdownOpen(false);
  };

  const handleEditViewClick = () => {
    if (!activeCustomView) return;
    setViewName(activeCustomView.labelVi);
    setViewNameError("");
    setSavedViewDialog({ mode: "edit", viewKey: activeCustomView.key });
  };

  const handleSubmitSavedView = (event: React.FormEvent) => {
    event.preventDefault();
    if (!savedViewDialog || viewSaveInFlightRef.current) return;
    const trimmedName = viewName.trim();
    if (!trimmedName) {
      setViewNameError(isVi ? "Vui lòng nhập tên giao diện." : "Enter a view name.");
      return;
    }
    viewSaveInFlightRef.current = true;
    setIsSavingView(true);
    try {
      const result = savedViewDialog.mode === "edit"
        ? updateCustomView(savedViewDialog.viewKey, trimmedName, getCurrentViewSnapshot())
        : createCustomView(trimmedName, getCurrentViewSnapshot());
      if (result.ok === false) {
        setViewNameError(result.error === "duplicate" ? (isVi ? "Tên giao diện đã tồn tại." : "This view name already exists.") : (isVi ? "Không thể lưu giao diện." : "Could not save this view."));
        return;
      }
      setSavedViewDialog(null);
      setViewName("");
      showToast(isVi ? "Đã lưu giao diện khách hàng." : "Customer view saved.");
    } finally {
      viewSaveInFlightRef.current = false;
      setIsSavingView(false);
    }
  };

  const handleDeleteCustomView = () => {
    if (!viewToDelete) return;
    const defaultPresentation = deleteCustomView(viewToDelete);
    if (defaultPresentation) applyPresentation(defaultPresentation);
    setViewToDelete(null);
    showToast(isVi ? "Đã xóa giao diện." : "View deleted.");
  };

  const toggleRowSelection = (id: string, checked: boolean) => {
    setSelectedCustomerIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  };

  const toggleAllSelection = (checked: boolean) => {
    const visibleIds = pagination.pageItems.map((row) => row.customer.id);
    setSelectedCustomerIds((current) => checked ? [...new Set([...current, ...visibleIds])] : current.filter((id) => !visibleIds.includes(id)));
  };

  const selectedRows = rows.filter((row) => selectedCustomerIds.includes(row.customer.id));

  const requestBulkArchive = () => {
    if (selectedRows.length > 0) setArchiveTargets(selectedRows.filter((row) => row.customer.status !== "ARCHIVED"));
  };

  const confirmArchive = async () => {
    await Promise.all(archiveTargets.map((row) => archiveCustomerCommand(row.customer.id, {
      reason: "Archived from the customer workspace",
      actorId,
      actorName,
    })));
    setArchiveTargets([]);
    setSelectedCustomerIds([]);
    showToast(isVi ? "Đã lưu trữ khách hàng được chọn." : "Selected customers archived.");
  };

  const exportAll = () => {
    const payload = rows.map((row) => ({
      customer: row.customer,
      identity: row.model.identity,
      metrics: row.model.metrics,
    }));
    const anchor = document.createElement("a");
    anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
    anchor.download = `unicorecrm-customers-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    showToast(isVi ? "Đã xuất dữ liệu khách hàng." : "Customer data exported.");
  };

  const openCustomer = (customerId: string) => navigate(`/customers/${customerId}`);
  const openSource = (row: CustomerListRow) => navigate(customerSourceIdentityPath(row));
  const openActionCenter = (row: CustomerListRow) => navigate(`/customers/${row.customer.id}`);

  return (
    <><AuthoritativeQueryNotice connected={customerSource.query.connected} loading={customerSource.query.loading} refreshing={customerSource.query.refreshing} stale={customerSource.query.stale} loadedAt={customerSource.query.loadedAt} error={customerSource.query.error} onRefresh={() => void customerSource.query.refresh()} compact /><ListPageFrame id="customer-workspace" className="text-slate-700">
      <ListPageHeader
        title={isVi ? "Khách hàng" : "Customers"}
        count={filteredRows.length}
        context={isVi ? "Customer relationship center" : "Customer relationship center"}
        icon={<Users size={18} />}
        actions={(
          <PageHeaderActions
            actions={[
              {
                id: "add-customer-relationship",
                label: isVi ? "Thêm liên hệ / tổ chức" : "Add Contact / Organization",
                onClick: () => navigate("/contacts"),
                variant: "secondary",
              },
              {
                id: "customer-data-quality",
                label: isVi ? "Chất lượng dữ liệu" : "Data quality",
                onClick: () => setDataQualityOpen(true),
                variant: "secondary",
              },
              ...(canOnboardExistingCustomer ? [{
                id: "onboard-existing-customer",
                label: isVi ? "Ghi nhận khách hàng hiện hữu" : "Onboard existing customer",
                icon: <Plus size={14} />,
                onClick: () => setOnboardingOpen(true),
                variant: "primary" as const,
              }] : []),
            ]}
            moreActions={(
              <CustomerTopActionMenu
                selectedCount={selectedCustomerIds.length}
                onExportAll={exportAll}
                onPrintList={() => window.print()}
                onBulkArchive={requestBulkArchive}
                onOpenSegments={() => navigate("/customers/segments")}
                onOpenHealth={() => navigate("/customers/health")}
                onOpenArchived={() => {
                  setStatusFilter("ARCHIVED");
                  handleSelectSavedView("archived");
                }}
                onDownloadImportTemplate={() => showToast(isVi ? "Mẫu nhập liệu thuộc owner Contact/Tổ chức." : "Import templates belong to Contact/Organization owners.")}
                onAdvancedImport={() => navigate("/contacts")}
              />
            )}
          />
        )}
      />

      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={isVi ? "Tìm theo tên, mã khách hàng, SĐT, email, mã số thuế..." : "Search name, customer code, phone, email, tax code..."}
        viewMode={viewMode}
        onViewModeChange={(value) => setViewMode(value as "table" | "card")}
        viewOptions={[
          { value: "table" as const, label: isVi ? "Dạng bảng" : "Table view" },
          { value: "card" as const, label: isVi ? "Dạng thẻ" : "Card view" },
        ]}
        showFilters
        onOpenFilters={() => setIsFilterOpen((open) => !open)}
        onCloseFilters={() => setIsFilterOpen(false)}
        filtersOpen={isFilterOpen}
        filtersPanel={(
          <CustomerFilterPopover
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            healthFilter={healthFilter}
            setHealthFilter={setHealthFilter}
            ownerFilter={ownerFilter}
            setOwnerFilter={setOwnerFilter}
            segmentFilter={segmentFilter}
            setSegmentFilter={setSegmentFilter}
            nextCareDateFilter={nextCareDateFilter}
            setNextCareDateFilter={setNextCareDateFilter}
            segments={segments}
            onResetAll={() => {
              resetFilters();
              showToast(isVi ? "Đã đặt lại tất cả bộ lọc." : "All filters reset.");
            }}
          />
        )}
        showColumns
        onOpenColumns={() => setIsColumnSettingsOpen(true)}
        showStats
        onOpenStats={() => setShowStatisticsPanel(true)}
        activeFilterCount={activeFiltersCount}
        hasActiveFilters={hasActiveFilters}
        filtersLabel={isVi ? "Bộ lọc" : "Filters"}
        columnsLabel={isVi ? "Cột" : "Columns"}
        statsLabel={isVi ? "Thống kê" : "Statistics"}
        leftSlot={(
          <div className="flex items-center gap-2 shrink-0">
            <CustomerSavedViewSelector
              views={customViews}
              activeView={activeView}
              onSelectView={handleSelectSavedView}
              isOpen={isViewDropdownOpen}
              onOpenChange={setIsViewDropdownOpen}
              customerCount={filteredRows.length}
              onAddViewClick={handleAddViewClick}
            />
            {activeCustomView && (
              <>
                <IconButton type="button" variant="ghost" size="sm" onClick={handleEditViewClick} className="h-8 w-8 rounded-xl text-slate-500 hover:text-indigo-600" title={isVi ? `Sửa giao diện ${activeCustomView.labelVi}` : `Edit view ${activeCustomView.labelEn}`}>
                  <Pencil size={14} />
                </IconButton>
                <IconButton type="button" variant="ghost" size="sm" onClick={() => setViewToDelete(activeView)} className="h-8 w-8 rounded-xl text-slate-500 hover:text-red-600" title={isVi ? `Xóa giao diện ${activeCustomView.labelVi}` : `Delete view ${activeCustomView.labelEn}`}>
                  <Trash2 size={14} />
                </IconButton>
              </>
            )}
          </div>
        )}
        rightSlot={(
          <button
            type="button"
            onClick={() => showToast(isVi ? "Đã làm mới dữ liệu." : "Data refreshed.")}
            className="p-2.5 text-slate-600 hover:text-violet-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs transition-all flex items-center justify-center h-10 w-10 cursor-pointer"
            title={isVi ? "Làm mới" : "Refresh"}
          >
            <RefreshCw size={14} />
          </button>
        )}
      />

      <ListBulkActionBar selectedCount={selectedCustomerIds.length} label={isVi ? "Đã chọn" : "Selected"} onClear={() => setSelectedCustomerIds([])}>
        <button type="button" onClick={() => selectedRows[0] && openCustomer(selectedRows[0].customer.id)} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-blue-700 shadow-sm hover:bg-slate-100">
          {isVi ? "Mở hồ sơ khách hàng" : "Open Customer 360"}
        </button>
        <button type="button" onClick={requestBulkArchive} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-100">
          <Archive size={11} />
          <span>{isVi ? "Lưu trữ" : "Archive"}</span>
        </button>
      </ListBulkActionBar>

      <SavedViewNameModal
        isOpen={savedViewDialog !== null}
        onClose={() => setSavedViewDialog(null)}
        mode={savedViewDialog?.mode ?? "create"}
        name={viewName}
        onNameChange={(name) => { setViewName(name); if (viewNameError) setViewNameError(""); }}
        onSubmit={handleSubmitSavedView}
        error={viewNameError || undefined}
        loading={isSavingView}
        formId="customer-saved-view-form"
      />

      <ConfirmDialog
        isOpen={Boolean(viewToDelete)}
        onClose={() => setViewToDelete(null)}
        onConfirm={handleDeleteCustomView}
        title={isVi ? "Xóa giao diện?" : "Delete view?"}
        description={isVi ? "Giao diện đã lưu sẽ bị xóa và danh sách trở về cấu hình mặc định." : "The saved view will be deleted and the list will return to the default configuration."}
        confirmText={isVi ? "Xóa giao diện" : "Delete view"}
        cancelText={isVi ? "Hủy" : "Cancel"}
        type="danger"
      />

      {filteredRows.length === 0 ? (
        <ListStatePanel
          kind="empty"
          title={isVi ? "Không có khách hàng phù hợp" : "No matching customers"}
          action={<button type="button" onClick={() => navigate("/contacts")} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700">{isVi ? "Mở danh sách Contact" : "Open contacts"}</button>}
        />
      ) : (
        <>
          <div className={viewMode === "card" ? "block" : "block md:hidden"}>
            <CustomerCardList
              rows={pagination.pageItems}
              selectedCustomerIds={selectedCustomerIds}
              onSelectRow={toggleRowSelection}
              openRowActionId={openRowActionId}
              setOpenRowActionId={setOpenRowActionId}
              onViewDetails={openCustomer}
              onOpenSource={openSource}
              onCreateOpportunity={openActionCenter}
              onCreateQuote={(row) => navigate(`/quotes/new?customerId=${row.customer.id}`)}
              onCreateOrder={(row) => navigate(`/orders/new?customerId=${row.customer.id}`)}
              onCreateTask={openActionCenter}
              onArchive={(row) => setArchiveTargets([row])}
            />
          </div>
          <div className={viewMode === "table" ? "hidden md:block" : "hidden"}>
            <CustomerTable
              rows={pagination.pageItems}
              visibleColumns={visibleColumns}
              columnWidths={columnWidths}
              selectedCustomerIds={selectedCustomerIds}
              onSelectAll={toggleAllSelection}
              onSelectRow={toggleRowSelection}
              onColumnResize={resizeColumn}
              onColumnReset={resetColumnWidth}
              openRowActionId={openRowActionId}
              setOpenRowActionId={setOpenRowActionId}
              onViewDetails={openCustomer}
              onOpenSource={openSource}
              onCreateOpportunity={openActionCenter}
              onCreateQuote={(row) => navigate(`/quotes/new?customerId=${row.customer.id}`)}
              onCreateOrder={(row) => navigate(`/orders/new?customerId=${row.customer.id}`)}
              onCreateTask={openActionCenter}
              onArchive={(row) => setArchiveTargets([row])}
            />
          </div>
          <ListPaginationBar
            {...pagination}
            itemLabelVi="khách hàng"
            itemLabelEn="customers"
          />
        </>
      )}

      <CustomerColumnSettingsDrawer
        isOpen={isColumnSettingsOpen}
        onClose={() => setIsColumnSettingsOpen(false)}
        allFields={CUSTOMER_COLUMNS_METADATA.map((column) => column.key)}
        visibleColumns={visibleColumns}
        onSave={saveColumnSettings}
        onResetDefault={resetColumnSettings}
      />


      <CustomerStatisticsPanel show={showStatisticsPanel} onClose={() => setShowStatisticsPanel(false)} statsSummary={statistics} />

      <ConfirmDialog
        isOpen={archiveTargets.length > 0}
        onClose={() => setArchiveTargets([])}
        onConfirm={confirmArchive}
        title={isVi ? "Lưu trữ khách hàng?" : "Archive customers?"}
        description={archiveTargets.length === 1 ? archiveTargets[0]?.model.identity.displayName : (isVi ? `${archiveTargets.length} khách hàng được chọn` : `${archiveTargets.length} selected customers`)}
        confirmText={isVi ? "Lưu trữ" : "Archive"}
        cancelText={isVi ? "Hủy" : "Cancel"}
        type="danger"
      />

      <CustomerDataQualityPanel isOpen={dataQualityOpen} onClose={() => setDataQualityOpen(false)} isVi={isVi} />

      <ExistingCustomerOnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        actorId={actorId}
        isVi={isVi}
        onCompleted={(createdCustomer) => {
          showToast(isVi ? "Đã ghi nhận khách hàng từ bằng chứng mua hàng." : "Customer created from purchase evidence.");
          navigate(`/customers/${createdCustomer.id}`);
        }}
      />

      <AnimatePresence>
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-xl animate-fade-in font-sans">
            <Sparkles size={14} className="text-indigo-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </AnimatePresence>
    </ListPageFrame>
  </>);
};
