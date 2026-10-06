import { registerUnsavedWork } from "@/platform/unsaved-work";
import { requestDecision } from "@/components/feedback/ProductDialogService";
import { useEffect, useMemo, useState, useRef } from "react";
import { useI18n } from "@/i18n";
import { formatOperationUnavailableError, backendUnavailableMessage } from "@/shared/operations";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
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

  const handleFormSubmit = async (data: Product, opening: Product | null, intentId: string, isCurrent: () => boolean): Promise<boolean> => {
    try {
      const draft = data;
      await saveProductCommand(draft, { idempotencyKey: intentId });
      if (!isCurrent()) return false;
      triggerToast(opening?.id
        ? tx("products.toast.updateSuccess", "Cập nhật sản phẩm thành công.")
        : tx("products.toast.createSuccess", "Tạo sản phẩm mới thành công."));
      return true;
    } catch (error) {
      throw error;
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

  const handleDeleteConfirm = async (isCurrent: () => boolean = () => true) => {
    const productIds = deleteDialog.isBulk
      ? selectedProductIds
      : deleteDialog.product ? [deleteDialog.product.id] : [];
    if (productIds.length === 0) return;

    await archiveProductsCommand(productIds, {
      reason: "Archived from the product catalog",
      actorId,
      actorName,
    });
    if (!isCurrent()) return;
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

  const importPending = useRef(false);
  const importCycle = useRef(0);
  const importWorkspace = useRef(workspace.workspaceId);
  useEffect(() => { importCycle.current += 1; if (isImportModalOpen) importWorkspace.current = getWorkspaceContextSnapshot().workspaceId; }, [isImportModalOpen]);
  const importMounted = useRef(true);
  useEffect(() => { importMounted.current = true; return () => { importMounted.current = false; }; }, []);
  const closeImport = () => {
    if (importPending.current) return;
    importCycle.current += 1;
    setPastedCsvData(""); setIsImportModalOpen(false);
  };
  useEffect(() => { if (isImportModalOpen && workspace.workspaceId !== importWorkspace.current && !pastedCsvData.trim() && !importPending.current) closeImport(); });
  const requestImportClose = async () => {
    if (importPending.current) return;
    if (pastedCsvData.trim()) {
      const decision = await requestDecision({ title: locale === "vi" ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?",
        message: locale === "vi" ? "Dữ liệu CSV chưa được nhập." : "CSV data has not been imported.", tone: "warning",
        actions: [{ id: "keep", label: locale === "vi" ? "Tiếp tục chỉnh sửa" : "Keep editing", variant: "secondary" },
          { id: "discard", label: locale === "vi" ? "Bỏ thay đổi" : "Discard changes", variant: "danger" }],
      });
      if (decision !== "discard" || !importMounted.current || importPending.current) return;
    }
    closeImport();
  };
  useEffect(() => {
    if (!isImportModalOpen) return;
    const registeredCycle = importCycle.current;
    const unregister = registerUnsavedWork({ id: "product-import", title: locale === "vi" ? "Nhập sản phẩm" : "Import products",
      isDirty: Boolean(pastedCsvData.trim()), save: async () => !importMounted.current || importPending.current || importCycle.current !== registeredCycle || getWorkspaceContextSnapshot().workspaceId !== importWorkspace.current ? false : parseAndImportCSV(pastedCsvData),
      canDiscard: () => !importPending.current && importMounted.current && importCycle.current === registeredCycle,
      discard: closeImport,
    });
    const warn = (event: BeforeUnloadEvent) => { if (pastedCsvData.trim()) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { unregister(); window.removeEventListener("beforeunload", warn); };
  });
  const parseAndImportCSV = (csvText: string): boolean => {
    if (importPending.current || !importMounted.current || getWorkspaceContextSnapshot().workspaceId !== importWorkspace.current) return false;
    if (!csvText.trim()) {
      triggerToast("Dữ liệu CSV trống. Vui lòng nhập dữ liệu.", "error");
      document.getElementById("product-import-csv-textarea")?.focus();
      return false;
    }

    importPending.current = true;
    try {
      assertProductCatalogImportAvailable();
      const importedList = parseProductsCsv(csvText, workspaceConfiguration.localeRegion.currencies.baseCurrency);
      if (importedList.length === 0) {
        triggerToast("Không tìm thấy dòng sản phẩm hợp lệ nào.", "error");
        document.getElementById("product-import-csv-textarea")?.focus();
      return false;
      }

      saveCatalogState([...importedList, ...products]);
      setIsImportModalOpen(false);
      setPastedCsvData("");
      triggerToast(`Đồng bộ thành công ${importedList.length} sản phẩm mới từ danh sách CSV sheets!`, "success");
      return true;
    } catch (error) {
      const applicationError = normalizeApplicationError(error);
      const message = applicationError.code === "CSV_EMPTY"
        ? "Cấu trúc CSV không hợp lệ (cần tối thiểu dòng tiêu đề và 1 dòng dữ liệu)."
        : "Không thể đọc file CSV. Hãy kiểm tra định dạng và thử lại.";
      triggerToast(message, "error");
      return false;
    } finally { importPending.current = false; }
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
    requestImportClose,
    parseAndImportCSV,
    handleRefresh,
    columnWidths,
    handleResetColumnWidths,
    handleColumnResize,
    handleColumnReset,
  };
}
