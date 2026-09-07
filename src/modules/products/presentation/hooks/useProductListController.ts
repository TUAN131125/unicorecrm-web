import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { formatOperationUnavailableError, backendUnavailableMessage } from "@/shared/operations";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { getProductCollectionResource } from "../../application/vertical-slice/productAuthoritativeQueries";
import { normalizeApplicationError } from "@/shared/domain";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { parseProductsCsv } from "../../application/import-export/productCsv";
import {
  createProductDuplicateDraft,
} from "../../application/commands/productCatalogCommands";
import {
  getProductCatalogStats,
  getProductCategories,
  getProductTags,
  queryProducts,
  type ProductListFilters,
} from "../../application/queries/productCatalogQueries";
import type { Product, ProductStatus } from "../../domain/model/product.types";
import {
  archiveProductsCommand,
  assertProductCatalogImportAvailable,
  exportProductCatalogCsv,
  exportProductCatalogJson,
  getProductCatalogSnapshot,
  getProductPreference,
  replaceProductCatalog,
  restoreProductsCommand,
  saveProductCommand,
  isProductDemoCatalogResetUnavailable,
  resetProductCatalogToDemo,
  setProductPreference,
  subscribeToProductCatalog,
} from "../../public/catalog";
import { useProductListColumns } from "./useProductListColumns";
import { useTransientToast } from "./useTransientToast";

export { PRODUCT_LIST_ALL_COLUMNS } from "./useProductListColumns";

export interface ProductListPageProps {
  leads?: any[];
  deals?: any[];
  quotes?: any[];
  customers?: any[];
  orders?: Record<string, any[]>;
}

export function useProductListController({
  leads = [],
  deals = [],
  quotes = [],
  customers = [],
  orders = {},
}: ProductListPageProps) {
  const { tx, locale } = useI18n();
  const workspace = useWorkspaceContextSnapshot();
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const productQuery = useModuleAuthoritativeResource(getProductCollectionResource(), {
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceProductCatalog([]),
  });
  const { toast, triggerToast } = useTransientToast();
  const access = useEffectiveAccess();
  const canCreateProduct = access.can(CAPABILITIES.PRODUCTS_CREATE);
  const canEditProduct = access.can(CAPABILITIES.PRODUCTS_EDIT);
  const canArchiveProduct = access.can(CAPABILITIES.PRODUCTS_DELETE);
  const canRestoreProduct = access.can(CAPABILITIES.PRODUCTS_EDIT);
  const canManageProduct = canCreateProduct || canEditProduct || canArchiveProduct;
  const session = getAuthSessionSnapshot();
  const actorId = session?.principal.memberId ?? session?.principal.email ?? "system";
  const actorName = session?.principal.displayName ?? session?.principal.email ?? "CRM User";

  const canManage = canManageProduct;

  const {
    visibleColumns,
    isColumnSettingsOpen,
    setIsColumnSettingsOpen,
    handleSaveColumns,
    handleResetDefaultColumns,
    columnWidths,
    handleResetColumnWidths,
    handleColumnResize,
    handleColumnReset,
  } = useProductListColumns({ notify: triggerToast, tx });

  // The page reads/writes through the repository port instead of browser storage directly.
  const [products, setProducts] = useState<Product[]>(getProductCatalogSnapshot);

  useEffect(() => subscribeToProductCatalog(setProducts), []);

  const saveCatalogState = (newProducts: Product[]) => {
    setProducts(newProducts);
    replaceProductCatalog(newProducts);
  };

  // State: Selection, View Modes, Sorting
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "card">(() =>
    getProductPreference(
      "centrix_product_list_view_mode",
      typeof window !== "undefined" && window.innerWidth < 768 ? "card" : "table",
    ),
  );

  const handleSetViewMode = (mode: "table" | "card") => {
    setViewMode(mode);
    setProductPreference("centrix_product_list_view_mode", mode);
  };

  const [sortField, setSortField] = useState<string>("sku");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // State: Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // State: Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    category: "all",
    billingCycle: "all",
    tag: "all",
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
  });

  // Custom setters to force reset currentPage to 1 when criteria narrows
  const handleSetSearchTerm = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleSetFilters = (val: any) => {
    setFilters(val);
    setCurrentPage(1);
  };

  // State: Menu/Dropdown
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [moreCatalogAnchor, setMoreCatalogAnchor] = useState<HTMLElement | null>(null);

  // State: Modals & Dialogs
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeFormProduct, setActiveFormProduct] = useState<Product | null>(null);

  // Custom Delete Confirm Dialog State
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    product: Product | null;
    isBulk: boolean;
  }>({
    isOpen: false,
    product: null,
    isBulk: false,
  });

  const categoriesList = useMemo(() => getProductCategories(products), [products]);
  const tagsList = useMemo(() => getProductTags(products), [products]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const normalizedSortField =
    sortField === "productName" ? "name" :
    sortField === "price" ? "listPrice" :
    sortField === "tax" ? "taxRate" :
    sortField === "warranty" ? "warrantyMonths" : sortField;

  const filteredProducts = useMemo(
    () => queryProducts(products, searchTerm, filters as ProductListFilters, normalizedSortField, sortOrder),
    [products, searchTerm, filters, normalizedSortField, sortOrder],
  );

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const startIndex = (activePage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [filteredProducts, activePage]);

  const stats = useMemo(() => getProductCatalogStats(products), [products]);

  // Multi-Selection Checkbox Managers
  const handleSelectProduct = (id: string, isSelected: boolean) => {
    setSelectedProductIds((prev) => {
      if (isSelected) {
        return [...prev, id];
      } else {
        return prev.filter((pId) => pId !== id);
      }
    });
  };

  const handleSelectAllProducts = (isSelected: boolean) => {
    if (isSelected) {
      const ids = filteredProducts.map((p) => p.id);
      setSelectedProductIds(ids);
    } else {
      setSelectedProductIds([]);
    }
  };

  // Reset Filters logic
  const handleResetFilters = () => {
    setSearchTerm("");
    setFilters({
      type: "all",
      status: "all",
      category: "all",
      billingCycle: "all",
      tag: "all",
      minPrice: undefined,
      maxPrice: undefined,
    });
    triggerToast(tx("products.filters.clear", "Đã xóa toàn bộ bộ lọc chủ động"), "info");
  };

  const handleFormSubmit = async (data: Partial<Product>) => {
    try {
      const draft = { ...(activeFormProduct ?? {}), ...data } as Product;
      await saveProductCommand(draft);
      triggerToast(activeFormProduct?.id
        ? tx("products.toast.updateSuccess", "Cập nhật sản phẩm thành công.")
        : tx("products.toast.createSuccess", "Tạo sản phẩm mới thành công."));
      setIsFormOpen(false);
      setActiveFormProduct(null);
    } catch (error) {
      triggerToast(formatOperationUnavailableError(error, { locale }), "error");
    }
  };

  const handleEditProduct = (product: Product) => {
    setActiveFormProduct(product);
    setIsFormOpen(true);
  };

  const handleDuplicateProduct = (product: Product) => {
    setActiveFormProduct(createProductDuplicateDraft(products, product));
    setIsFormOpen(true);
    triggerToast(tx("products.toast.duplicateSuccess", "Đã sao chép cấu hình. Vui lòng đặt mã SKU mới và lưu."), "info");
  };

  const handleArchiveToggle = async (product: Product) => {
    try {
      if (product.status === "archived") {
        await restoreProductsCommand([product.id], { actorId, actorName });
        triggerToast(tx("products.toast.unarchiveSuccess", "Đã đưa sản phẩm quay lại kinh doanh."));
      } else {
        await archiveProductsCommand([product.id], { reason: "Archived from product catalog", actorId, actorName });
        triggerToast(tx("products.toast.archiveSuccess", "Sản phẩm đã được lưu trữ trong danh mục phụ."));
      }
    } catch (error) { triggerToast(formatOperationUnavailableError(error, { locale }), "error"); }
  };

  const usageSources = useMemo(() => ({
    leads,
    deals,
    quotes,
    orders: Object.values(orders).flat(),
    customers,
  }), [leads, deals, quotes, orders, customers]);

  // Actions: Delete Confirm Dialog Toggles
  const handleDeleteTrigger = (prod: Product) => {
    setDeleteDialog({
      isOpen: true,
      product: prod,
      isBulk: false,
    });
  };

  const handleDeleteConfirm = async () => {
    const productIds = deleteDialog.isBulk
      ? selectedProductIds
      : deleteDialog.product ? [deleteDialog.product.id] : [];
    if (productIds.length === 0) return;

    await archiveProductsCommand(productIds, {
      reason: "Archived from the product catalog",
      actorId,
      actorName,
    });
    setSelectedProductIds((current) => current.filter((id) => !productIds.includes(id)));
    triggerToast(tx("products.toast.archiveSuccess", "Sản phẩm đã được lưu trữ và lịch sử sử dụng được giữ lại."));
    setDeleteDialog({ isOpen: false, product: null, isBulk: false });
  };

  // Actions: Bulk operations
  const handleBulkArchive = async () => {
    try { await archiveProductsCommand(selectedProductIds, { reason: "Bulk archive from product catalog", actorId, actorName }); setSelectedProductIds([]); triggerToast(tx("products.toast.archiveSuccess", "Hàng loạt sản phẩm đã được lưu trữ.")); }
    catch (error) { triggerToast(formatOperationUnavailableError(error, { locale }), "error"); }
  };

  const handleBulkUnarchive = async () => {
    try { await restoreProductsCommand(selectedProductIds, { actorId, actorName }); setSelectedProductIds([]); triggerToast(tx("products.toast.unarchiveSuccess", "Hàng loạt sản phẩm đã được hủy lưu trữ thành công.")); }
    catch (error) { triggerToast(formatOperationUnavailableError(error, { locale }), "error"); }
  };

  const handleExportCatalog = () => {
    try {
      exportProductCatalogJson(products);
      triggerToast("Đã xuất danh mục thành file JSON thành công!", "success");
    } catch {
      triggerToast("Đã xảy ra lỗi khi xuất file danh mục.", "error");
    }
  };

  const handleExportCSV = () => {
    try {
      exportProductCatalogCsv(products);
      triggerToast("Đã xuất danh mục thành file CSV thành công!", "success");
    } catch {
      triggerToast("Đã xảy ra lỗi khi xuất file danh mục CSV.", "error");
    }
  };

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pastedCsvData, setPastedCsvData] = useState("");

  const parseAndImportCSV = (csvText: string) => {
    if (!csvText.trim()) {
      triggerToast("Dữ liệu CSV trống. Vui lòng nhập dữ liệu.", "error");
      return;
    }

    try {
      assertProductCatalogImportAvailable();
      const importedList = parseProductsCsv(csvText, workspaceConfiguration.localeRegion.currencies.baseCurrency);
      if (importedList.length === 0) {
        triggerToast("Không tìm thấy dòng sản phẩm hợp lệ nào.", "error");
        return;
      }

      saveCatalogState([...importedList, ...products]);
      setIsImportModalOpen(false);
      setPastedCsvData("");
      triggerToast(`Đồng bộ thành công ${importedList.length} sản phẩm mới từ danh sách CSV sheets!`, "success");
    } catch (error) {
      const applicationError = normalizeApplicationError(error);
      const message = applicationError.code === "CSV_EMPTY"
        ? "Cấu trúc CSV không hợp lệ (cần tối thiểu dòng tiêu đề và 1 dòng dữ liệu)."
        : "Không thể đọc file CSV. Hãy kiểm tra định dạng và thử lại.";
      triggerToast(message, "error");
    }
  };

  // Actions: Restore the module-owned demo catalog
  const handleRefresh = () => {
    // Restoring the demo catalog is a demo-authoritative operation: connected mode has no
    // backend reset contract, so the action is refused before the catalog is touched.
    if (isProductDemoCatalogResetUnavailable()) {
      triggerToast(backendUnavailableMessage({
        locale,
        action: locale === "vi" ? "Nhập lại danh mục mẫu" : "Restoring the sample catalog",
      }), "error");
      return;
    }
    try { setProducts(resetProductCatalogToDemo()); setSelectedProductIds([]); triggerToast(tx("products.toast.importSuccess", "Nhập lại danh sách 12 sản phẩm mẫu thành công."), "success"); }
    catch (error) { triggerToast(formatOperationUnavailableError(error, { locale }), "error"); }
  };

  return {
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
    products,
    selectedProductIds,
    setSelectedProductIds,
    viewMode,
    setViewMode,
    handleSetViewMode,
    sortField,
    sortOrder,
    setCurrentPage,
    pageSize,
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    handleSetSearchTerm,
    handleSetFilters,
    isMoreMenuOpen,
    setIsMoreMenuOpen,
    moreCatalogAnchor,
    setMoreCatalogAnchor,
    isFormOpen,
    setIsFormOpen,
    activeFormProduct,
    setActiveFormProduct,
    deleteDialog,
    setDeleteDialog,
    toast,
    triggerToast,
    categoriesList,
    tagsList,
    handleSort,
    filteredProducts,
    totalPages,
    activePage,
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
  };
}
