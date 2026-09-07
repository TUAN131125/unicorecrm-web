import React, { useMemo } from "react";
import { AuthoritativeQueryNotice } from "@/shared/operations";
import { Archive, Download, Layers3, Package2, Plus, RefreshCw, Settings2, ShoppingBag, Upload } from "lucide-react";
import { ColumnSettingsDrawer } from "@/components/crm/ColumnSettingsDrawer";
import { ListBulkActionBar, ListPageFrame, ListPageHeader, ListStatePanel } from "@/components/crm/list-archetype";
import { ModulePageShell } from "@/components/crm/ModulePageShell";
import { Button, ConfirmDialog, Modal, StatCard, Textarea } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import {
  PRODUCT_LIST_ALL_COLUMNS,
  useProductListController,
  type ProductListPageProps,
} from "../hooks/useProductListController";
import { ProductCardGrid } from "../components/ProductCardGrid";
import { ProductFormModal } from "../components/ProductFormModal";
import { ProductTable } from "../components/ProductTable";
import { ProductToolbar } from "../components/ProductToolbar";
import { getProductCatalogSnapshot } from "../../public/catalog";

const formatCount = (value: number) => value.toLocaleString();

export const ProductListPage: React.FC<ProductListPageProps> = (props) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const {
    productQuery,
    tx,
    canCreateProduct,
    canEditProduct,
    canArchiveProduct,
    canRestoreProduct,
    canManage,
    visibleColumns,
    isColumnSettingsOpen,
    setIsColumnSettingsOpen,
    handleSaveColumns,
    handleResetDefaultColumns,
    selectedProductIds,
    setSelectedProductIds,
    viewMode,
    handleSetViewMode,
    sortField,
    sortOrder,
    searchTerm,
    filters,
    handleSetSearchTerm,
    handleSetFilters,
    isFormOpen,
    setIsFormOpen,
    activeFormProduct,
    setActiveFormProduct,
    deleteDialog,
    setDeleteDialog,
    toast,
    categoriesList,
    tagsList,
    handleSort,
    filteredProducts,
    totalPages,
    activePage,
    setCurrentPage,
    paginatedProducts,
    stats,
    handleSelectProduct,
    handleSelectAllProducts,
    handleResetFilters,
    handleFormSubmit,
    handleEditProduct,
    handleDuplicateProduct,
    handleArchiveToggle,
    handleDeleteTrigger,
    handleDeleteConfirm,
    handleBulkArchive,
    handleBulkUnarchive,
    handleExportCatalog,
    handleExportCSV,
    isImportModalOpen,
    setIsImportModalOpen,
    pastedCsvData,
    setPastedCsvData,
    parseAndImportCSV,
    handleRefresh,
    columnWidths,
    handleResetColumnWidths,
    handleColumnResize,
    handleColumnReset,
  } = useProductListController(props);

  const activeFiltersCount = useMemo(
    () => [
      filters.type !== "all",
      filters.status !== "all",
      filters.category !== "all",
      filters.billingCycle !== "all",
      filters.tag !== "all",
      filters.minPrice !== undefined,
      filters.maxPrice !== undefined,
      searchTerm.trim().length > 0,
    ].filter(Boolean).length,
    [filters, searchTerm],
  );

  const paginationLabel = useMemo(() => {
    if (filteredProducts.length === 0) return isVi ? "0 kết quả" : "0 results";
    const start = (activePage - 1) * 10 + 1;
    const end = Math.min(activePage * 10, filteredProducts.length);
    return isVi
      ? `${start}-${end} / ${filteredProducts.length} sản phẩm`
      : `${start}-${end} of ${filteredProducts.length} products`;
  }, [activePage, filteredProducts.length, isVi]);

  const listActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="secondary"
        size="md"
        icon={<RefreshCw size={14} />}
        onClick={handleRefresh}
      >
        {isVi ? "Nhập danh mục" : "Import catalog"}
      </Button>
      <Button
        variant="secondary"
        size="md"
        icon={<Download size={14} />}
        onClick={handleExportCSV}
      >
        {isVi ? "Xuất CSV" : "Export CSV"}
      </Button>
      {canManage && (
        <Button
          variant="secondary"
          size="md"
          icon={<Upload size={14} />}
          onClick={() => setIsImportModalOpen(true)}
        >
          {isVi ? "Nhập CSV" : "Import CSV"}
        </Button>
      )}
      {canCreateProduct && (
        <Button
          variant="primary"
          size="md"
          icon={<Plus size={14} />}
          onClick={() => {
            setActiveFormProduct(null);
            setIsFormOpen(true);
          }}
        >
          {isVi ? "Thêm sản phẩm" : "Add product"}
        </Button>
      )}
    </div>
  );

  return (
    <ModulePageShell id="product-list-page" className="min-w-0 overflow-x-hidden select-none text-slate-700">
      {toast && (
        <div className="pointer-events-none fixed right-6 top-16 z-50 animate-fade-in">
          <div className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
            {toast.message}
          </div>
        </div>
      )}

      <AuthoritativeQueryNotice connected={productQuery.connected} loading={productQuery.loading} refreshing={productQuery.refreshing} stale={productQuery.stale} loadedAt={productQuery.loadedAt} error={productQuery.error} onRefresh={() => void productQuery.refresh()} compact />
      <ListPageFrame id="products-list-archetype" className="min-w-0 px-4 py-4 md:px-6">
        <ListPageHeader
          id="products-list-header"
          title={isVi ? "Sản phẩm & Dịch vụ" : "Products & Services"}
          count={filteredProducts.length}
          context={isVi ? "Danh mục dùng chung cho báo giá, đơn hàng và khách hàng" : "Shared catalog for quotes, orders and customer ownership"}
          icon={<ShoppingBag size={18} />}
          actions={listActions}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            id="products-total-stat"
            title={isVi ? "Tổng danh mục" : "Catalog total"}
            value={formatCount(stats.totalCount)}
            subtitle={isVi ? "Sản phẩm & dịch vụ" : "Products & services"}
            icon={<Package2 size={18} />}
          />
          <StatCard
            id="products-active-stat"
            title={isVi ? "Đang kinh doanh" : "Active catalog"}
            value={formatCount(stats.activeOneTime + stats.activeRecurring)}
            subtitle={isVi ? "Có thể bán ngay" : "Available for selling"}
            icon={<ShoppingBag size={18} />}
          />
          <StatCard
            id="products-subscription-stat"
            title={isVi ? "Thuê bao / gia hạn" : "Subscriptions / renewals"}
            value={formatCount(stats.activeRecurring)}
            subtitle={isVi ? "Sản phẩm có vòng đời" : "Recurring / lifecycle products"}
            icon={<Layers3 size={18} />}
          />
          <StatCard
            id="products-archived-stat"
            title={isVi ? "Bản lưu trữ / nháp" : "Archived / draft"}
            value={formatCount(stats.draftAndArchived)}
            subtitle={isVi ? "Tạm ngưng hoặc chờ hoàn thiện" : "Paused or pending completion"}
            icon={<Archive size={18} />}
          />
        </div>

        <ProductToolbar
          id="products-list-toolbar"
          searchTerm={searchTerm}
          setSearchTerm={handleSetSearchTerm}
          viewMode={viewMode}
          setViewMode={handleSetViewMode}
          filters={filters}
          setFilters={handleSetFilters}
          categories={categoriesList}
          tags={tagsList}
          onRefresh={handleRefresh}
          onResetFilters={handleResetFilters}
          onOpenColumnSettings={() => setIsColumnSettingsOpen(true)}
        />

        <ListBulkActionBar
          selectedCount={selectedProductIds.length}
          label={isVi ? "Đã chọn" : "Selected"}
          onClear={() => setSelectedProductIds([])}
        >
          {canArchiveProduct && (
            <Button size="sm" variant="secondary" icon={<Archive size={13} />} onClick={handleBulkArchive}>
              {isVi ? "Lưu trữ" : "Archive"}
            </Button>
          )}
          {canRestoreProduct && (
            <Button size="sm" variant="secondary" icon={<RefreshCw size={13} />} onClick={handleBulkUnarchive}>
              {isVi ? "Mở lại" : "Restore"}
            </Button>
          )}
          {canArchiveProduct && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setDeleteDialog({ isOpen: true, product: null, isBulk: true })}
            >
              {isVi ? "Lưu trữ" : "Archive"}
            </Button>
          )}
        </ListBulkActionBar>

        {filteredProducts.length === 0 ? (
          <ListStatePanel
            kind="empty"
            title={isVi ? "Chưa có sản phẩm phù hợp" : "No matching products"}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="secondary" onClick={handleRefresh}>{isVi ? "Nhập danh mục" : "Import catalog"}</Button>
                {canCreateProduct && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setActiveFormProduct(null);
                      setIsFormOpen(true);
                    }}
                  >
                    {isVi ? "Thêm sản phẩm" : "Add product"}
                  </Button>
                )}
              </div>
            }
          />
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900">
                  {isVi ? "Danh sách sản phẩm" : "Product list"}
                </h2>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span>{paginationLabel}</span>
                {viewMode === "table" && (
                  <Button size="sm" variant="secondary" icon={<Settings2 size={13} />} onClick={() => setIsColumnSettingsOpen(true)}>
                    {isVi ? "Cột hiển thị" : "Columns"}
                  </Button>
                )}
              </div>
            </div>

            <div className={viewMode === "card" ? "block min-w-0" : "block min-w-0 md:hidden"}>
              <ProductCardGrid
                id="product-list-cards"
                products={paginatedProducts}
                onEdit={handleEditProduct}
                onDuplicate={handleDuplicateProduct}
                onArchiveToggle={handleArchiveToggle}
                onDelete={handleDeleteTrigger}
                canEdit={canEditProduct}
                canDuplicate={canCreateProduct}
                canArchive={canArchiveProduct}
                canRestore={canRestoreProduct}
              />
            </div>

            <div className={viewMode === "table" ? "hidden min-w-0 max-w-full md:block" : "hidden"}>
              <ProductTable
                id="product-list-table"
                products={paginatedProducts}
                selectedProductIds={selectedProductIds}
                onSelectProduct={handleSelectProduct}
                onSelectAllProducts={handleSelectAllProducts}
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={handleSort}
                columnWidths={columnWidths}
                onColumnResize={handleColumnResize}
                onColumnReset={handleColumnReset}
                onEdit={handleEditProduct}
                onDuplicate={handleDuplicateProduct}
                onArchiveToggle={handleArchiveToggle}
                onDelete={handleDeleteTrigger}
                canEdit={canEditProduct}
                canDuplicate={canCreateProduct}
                canArchive={canArchiveProduct}
                canRestore={canRestoreProduct}
                visibleColumns={visibleColumns}
              />
            </div>

            {totalPages > 1 && (
              <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-slate-500">{paginationLabel}</p>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button size="sm" variant="secondary" disabled={activePage <= 1} onClick={() => setCurrentPage(activePage - 1)}>
                    {isVi ? "Trước" : "Previous"}
                  </Button>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                    {activePage} / {totalPages}
                  </div>
                  <Button size="sm" variant="secondary" disabled={activePage >= totalPages} onClick={() => setCurrentPage(activePage + 1)}>
                    {isVi ? "Sau" : "Next"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </ListPageFrame>

      <ColumnSettingsDrawer
        isOpen={isColumnSettingsOpen}
        onClose={() => setIsColumnSettingsOpen(false)}
        allFields={PRODUCT_LIST_ALL_COLUMNS}
        visibleColumns={visibleColumns}
        onSave={handleSaveColumns}
        onResetDefault={() => {
          handleResetDefaultColumns();
          handleResetColumnWidths();
        }}
        translationPrefix="products"
        defaultTitle={isVi ? "Tùy chỉnh cột sản phẩm" : "Customize product columns"}
        defaultSearchPlaceholder={isVi ? "Tìm cột..." : "Search columns..."}
        defaultSelectedCountLabel={isVi ? `Đã chọn (${visibleColumns.length})` : `Selected (${visibleColumns.length})`}
      />

      <ProductFormModal
        id="product-form-modal"
        isOpen={isFormOpen}
        product={activeFormProduct ?? undefined}
        onClose={() => {
          setIsFormOpen(false);
          setActiveFormProduct(null);
        }}
        onSubmit={handleFormSubmit}
        existingProducts={getProductCatalogSnapshot()}
      />

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, product: null, isBulk: false })}
        onConfirm={handleDeleteConfirm}
        title={deleteDialog.isBulk ? (isVi ? "Lưu trữ các sản phẩm đã chọn?" : "Archive selected products?") : (isVi ? "Lưu trữ sản phẩm này?" : "Archive this product?")}
        message={deleteDialog.isBulk
          ? (isVi ? "Sản phẩm sẽ được lưu trữ; toàn bộ liên kết và lịch sử CRM được giữ lại." : "Products will be archived while CRM links and history remain retained.")
          : (isVi ? "Thao tác này chỉ thành công nếu sản phẩm chưa liên kết với khách hàng, báo giá, đơn hàng hoặc cơ hội." : "This action succeeds only when the product is not linked to customers, quotes, orders or open commercial records.")}
        confirmText={isVi ? "Lưu trữ" : "Archive"}
        cancelText={isVi ? "Hủy" : "Cancel"}
        type="danger"
      />

      <Modal
        variant="form"
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={isVi ? "Nhập danh mục sản phẩm từ CSV" : "Import products from CSV"}
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>{isVi ? "Đóng" : "Close"}</Button>
            <Button variant="primary" onClick={() => parseAndImportCSV(pastedCsvData)}>{isVi ? "Nhập dữ liệu" : "Import data"}</Button>
          </>
        )}
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p className="text-xs font-medium leading-relaxed text-slate-500">
            {isVi
              ? "Dán nội dung CSV vào bên dưới. Hệ thống sẽ thêm các sản phẩm mới vào catalog hiện tại."
              : "Paste CSV content below. New products will be appended to the current catalog."}
          </p>
          <Textarea
            id="product-import-csv-textarea"
            value={pastedCsvData}
            onChange={(event) => setPastedCsvData(event.target.value)}
            rows={14}
            placeholder={isVi ? "sku,name,type,status,category,..." : "sku,name,type,status,category,..."}
            className="min-h-[320px] font-mono text-xs"
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <div className="font-medium text-slate-700">{isVi ? "Mẹo" : "Tips"}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{isVi ? "Giữ dòng tiêu đề CSV theo đúng cấu trúc export để import nhanh hơn." : "Keep the exported CSV header structure for the fastest import."}</li>
              <li>{isVi ? "Các sản phẩm đã tồn tại với SKU khác nhau sẽ được thêm mới, không ghi đè tự động." : "Rows with different SKUs are added as new records and are not auto-overwritten."}</li>
              <li>{isVi ? "Nếu muốn sao lưu toàn bộ catalog trước khi import, hãy dùng nút Xuất CSV ở header." : "Use Export CSV in the header if you want a backup before importing."}</li>
            </ul>
          </div>
        </div>
      </Modal>
    </ModulePageShell>
  );
};
