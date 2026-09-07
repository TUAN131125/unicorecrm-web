import { formatOperationUnavailableError } from "@/shared/operations";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Copy,
  DollarSign,
  Edit2,
  FileText,
  History,
  Package2,
  ShoppingBag,
  Users,
} from "lucide-react";
import { RecordDetailFrame, RecordDetailHeader, RecordDetailSection } from "@/components/crm/detail-archetype";
import { Button, ConfirmDialog, RecordTabTransition, ResponsiveTabs } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { normalizeApplicationError } from "@/shared/domain";
import { buildCustomer360ReadModel, getOwnedProductDisplay } from "@/modules/customers";
import { formatVnd } from "@/shared/lib/format/currency";
import { getProductUsageSummary } from "../../application/usage/productUsage";
import type { ProductAvailability, ProductPriceProjection } from "../../application/ports/ProductApiRuntime";
import { Product } from "../../domain/model/product.types";
import {
  calculateProductMarginPercent,
  formatBillingCycle,
  formatProductPrice,
  getProductStatusLabel,
  getProductTypeLabel,
} from "../../domain/rules/product.helpers";
import { archiveProductsCommand, getProductCatalogSnapshot, loadProductAvailability, loadProductDetail, loadProductPriceProjection, replaceProductCatalog, restoreProductsCommand, saveProductCommand, subscribeToProductCatalog } from "../../public/catalog";
import { ProductFormModal } from "../components/ProductFormModal";
import { ProductPriceBlock } from "../components/ProductPriceBlock";
import { ProductStatusBadge } from "../components/ProductStatusBadge";
import { ProductTypeBadge } from "../components/ProductTypeBadge";

interface ProductDetailPageProps {
  leads?: any[];
  deals?: any[];
  quotes?: any[];
  customers?: any[];
  orders?: Record<string, any[]>;
}

type ProductDetailTab = "overview" | "customers" | "commercial" | "activity";

type PurchasingCustomerRow = {
  customer: any;
  model: ReturnType<typeof buildCustomer360ReadModel>;
  ownedLines: any[];
  totalAmount: number;
  latestPurchaseAt?: string;
};

const ProductMetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ icon, label, value, hint }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
        {hint ? <p className="mt-1 text-xs font-medium text-slate-500">{hint}</p> : null}
      </div>
    </div>
  </div>
);

const DetailField: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="space-y-1">
    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
    <div className="text-sm font-semibold text-slate-800">{value ?? "—"}</div>
  </div>
);

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  leads = [],
  deals = [],
  quotes = [],
  customers = [],
  orders = {},
}) => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const session = getAuthSessionSnapshot();
  const access = useEffectiveAccess();
  const canCreateProduct = access.can(CAPABILITIES.PRODUCTS_CREATE);
  const canEditProduct = access.can(CAPABILITIES.PRODUCTS_EDIT);
  const canArchiveProduct = access.can(CAPABILITIES.PRODUCTS_DELETE);
  const canRestoreProduct = access.can(CAPABILITIES.PRODUCTS_EDIT);
  const actorId = session?.principal.memberId ?? session?.principal.email ?? "system";
  const actorName = session?.principal.displayName ?? session?.principal.email ?? "CRM User";

  const [products, setProducts] = useState<Product[]>(getProductCatalogSnapshot);
  useEffect(() => subscribeToProductCatalog(setProducts), []);

  const [activeTab, setActiveTab] = useState<ProductDetailTab>("overview");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeFormProduct, setActiveFormProduct] = useState<Product | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [toast, setToast] = useState<string>("");
  const [availability, setAvailability] = useState<ProductAvailability>();
  const [priceProjection, setPriceProjection] = useState<ProductPriceProjection>();
  const [projectionError, setProjectionError] = useState<string>();

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const product = useMemo(
    () => products.find((item) => item.id === productId) ?? null,
    [productId, products],
  );

  useEffect(() => {
    if (!productId) return undefined;
    const controller = new AbortController();
    void loadProductDetail(productId, controller.signal).catch((error) => {
      if (!controller.signal.aborted) setProjectionError(normalizeApplicationError(error).message);
    });
    return () => controller.abort();
  }, [productId]);

  useEffect(() => {
    if (!product) return undefined;
    const controller = new AbortController();
    setProjectionError(undefined);
    void Promise.all([
      loadProductAvailability(product, controller.signal),
      loadProductPriceProjection(product, "1", controller.signal),
    ]).then(([nextAvailability, nextPriceProjection]) => {
      setAvailability(nextAvailability);
      setPriceProjection(nextPriceProjection);
    }).catch((error) => {
      if (!controller.signal.aborted) setProjectionError(normalizeApplicationError(error).message);
    });
    return () => controller.abort();
  }, [product?.id, product?.resourceVersion]);

  const flattenedOrders = useMemo(() => Object.values(orders || {}).flat(), [orders]);

  const usageSummary = useMemo(() => {
    if (!product) {
      return {
        interestedLeads: 0,
        openDeals: 0,
        quotesCount: 0,
        ordersCount: 0,
        customersCount: 0,
        wonRevenue: 0,
        upcomingRenewals: 0,
      };
    }
    return getProductUsageSummary(product.id, {
      leads,
      deals,
      quotes,
      customers,
      orders: flattenedOrders,
    });
  }, [customers, deals, flattenedOrders, leads, product, quotes]);

  const linkedDeals = useMemo(
    () => !product ? [] : deals.filter((deal) => (deal.lineItems ?? []).some((line: any) => line.productId === product.id)),
    [deals, product],
  );

  const linkedQuotes = useMemo(
    () => !product ? [] : quotes.filter((quote) => (quote.lineItems ?? []).some((line: any) => line.productId === product.id)),
    [product, quotes],
  );

  const linkedOrders = useMemo(
    () => !product ? [] : flattenedOrders.filter((order) => (order.items ?? []).some((line: any) => line.productId === product.id)),
    [flattenedOrders, product],
  );

  const purchasingCustomers = useMemo<PurchasingCustomerRow[]>(() => {
    if (!product) return [];
    return (customers || []).flatMap((customer) => {
      const ownedLines = (customer.productsOwned ?? []).filter((owned: any) => owned.productId === product.id);
      if (ownedLines.length === 0) return [];
      const totalAmount = ownedLines.reduce((sum: number, line: any) => sum + (line.amount ?? 0), 0);
      const latestPurchaseAt = ownedLines
        .map((line: any) => line.purchaseDate)
        .filter(Boolean)
        .sort()
        .at(-1);
      return [{
        customer,
        model: buildCustomer360ReadModel(customer),
        ownedLines,
        totalAmount,
        latestPurchaseAt,
      }];
    });
  }, [customers, product]);

  if (!product) {
    return (
      <RecordDetailFrame id="product-detail-empty" className="px-4 py-4 md:px-6">
        <RecordDetailSection>
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Package2 size={28} />
            </div>
            <h3 className="mt-4 text-sm font-extrabold text-slate-900">
              {isVi ? "Không tìm thấy sản phẩm" : "Product not found"}
            </h3>
            <p className="mt-1 max-w-md text-xs font-medium leading-relaxed text-slate-500">
              {isVi ? "Sản phẩm có thể đã bị xóa, lưu trữ hoặc URL hiện tại không còn hợp lệ." : "The product may have been deleted, archived or the current URL is no longer valid."}
            </p>
            <Button className="mt-5" variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => navigate("/products")}>
              {isVi ? "Quay lại danh sách" : "Back to products"}
            </Button>
          </div>
        </RecordDetailSection>
      </RecordDetailFrame>
    );
  }

  const saveCatalogState = (nextProducts: Product[]) => {
    setProducts(nextProducts);
    replaceProductCatalog(nextProducts);
  };

  const analyzedMargin = product.costPrice !== undefined
    ? calculateProductMarginPercent(product.listPrice, product.costPrice)
    : undefined;
  const authoritativeTaxAmount = priceProjection
    ? `${priceProjection.taxAmount.amount} ${priceProjection.taxAmount.currency}`
    : projectionError ?? "…";
  const authoritativeTotal = priceProjection
    ? `${priceProjection.total.amount} ${priceProjection.total.currency}`
    : projectionError ?? "…";

  const handleEdit = () => {
    setActiveFormProduct(product);
    setIsFormOpen(true);
  };

  const handleDuplicate = () => {
    let potentialSku = `${product.sku}_COPY`;
    let counter = 1;
    while (products.some((item) => item.sku === potentialSku)) {
      potentialSku = `${product.sku}_COPY${counter}`;
      counter += 1;
    }

    const duplicateDraft: Product = {
      ...product,
      id: undefined as any,
      sku: potentialSku,
      name: `${product.name} (Copy)`,
      status: "draft",
    };
    setActiveFormProduct(duplicateDraft);
    setIsFormOpen(true);
  };

  const handleArchiveToggle = async () => {
    try {
      if (product.status === "archived") {
        await restoreProductsCommand([product.id], { actorId, actorName });
        showToast(isVi ? "Sản phẩm đã được mở lại để kinh doanh." : "Product restored to active catalog.");
      } else {
        await archiveProductsCommand([product.id], { reason: "Archived from product detail", actorId, actorName });
        showToast(isVi ? "Sản phẩm đã được lưu trữ." : "Product archived.");
      }
    } catch (error) { showToast(formatOperationUnavailableError(error, { locale })); }
  };

  const handleDeleteConfirm = async () => {
    await archiveProductsCommand([product.id], {
      reason: "Archived from product detail",
      actorId,
      actorName,
    });
    setIsDeleteOpen(false);
    navigate("/products");
  };

  const handleFormSubmit = async (data: Partial<Product>) => {
    try {
      const outcome = await saveProductCommand({ ...(activeFormProduct ?? {}), ...data } as Product);
      showToast(activeFormProduct?.id ? (isVi ? "Đã cập nhật sản phẩm." : "Product updated.") : (isVi ? "Đã tạo bản sao sản phẩm." : "Product duplicate created."));
      if (!activeFormProduct?.id) navigate(`/products/${outcome.data.id}`);
      setIsFormOpen(false);
      setActiveFormProduct(null);
    } catch (error) { showToast(formatOperationUnavailableError(error, { locale })); }
  };

  const tabItems = [
    { id: "overview", label: isVi ? "Tổng quan" : "Overview", icon: <Package2 size={13} /> },
    { id: "customers", label: isVi ? "Khách hàng đã mua" : "Customers", icon: <Users size={13} />, badge: purchasingCustomers.length },
    { id: "commercial", label: isVi ? "Khai thác thương mại" : "Commercial", icon: <BriefcaseBusiness size={13} />, badge: linkedQuotes.length + linkedDeals.length + linkedOrders.length },
    { id: "activity", label: isVi ? "Hoạt động" : "Activity", icon: <History size={13} /> },
  ];

  return (
    <RecordDetailFrame id="product-detail-page" className="px-4 py-4 md:px-6">
      {toast && (
        <div className="pointer-events-none fixed right-6 top-16 z-50 animate-fade-in">
          <div className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg">{toast}</div>
        </div>
      )}

      <RecordDetailHeader
        id="product-detail-header"
        backLabel={isVi ? "Quay lại danh mục" : "Back to products"}
        onBack={() => navigate("/products")}
        identityIcon={<ShoppingBag size={22} />}
        identityToneClassName="bg-violet-50 text-violet-600"
        title={product.name}
        status={<ProductStatusBadge status={product.status} />}
        metadata={(
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-mono font-bold text-slate-500">{product.sku}</span>
            <span>•</span>
            <ProductTypeBadge type={product.type} />
            <span>•</span>
            <span>{product.category}</span>
            <span>•</span>
            <span>{formatBillingCycle(product.billingCycle, (key: string, fallback?: string) => fallback || key)}</span>
          </div>
        )}
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canEditProduct && <Button size="sm" variant="secondary" icon={<Edit2 size={13} />} onClick={handleEdit}>
              {isVi ? "Chỉnh sửa" : "Edit"}
            </Button>}
            {canCreateProduct && <Button size="sm" variant="secondary" icon={<Copy size={13} />} onClick={handleDuplicate}>
              {isVi ? "Nhân bản" : "Duplicate"}
            </Button>}
            {((product.status === "archived" && canRestoreProduct) || (product.status !== "archived" && canArchiveProduct)) && <Button size="sm" variant="secondary" icon={<Archive size={13} />} onClick={handleArchiveToggle}>
              {product.status === "archived" ? (isVi ? "Bỏ lưu trữ" : "Restore") : (isVi ? "Lưu trữ" : "Archive")}
            </Button>}
            {canArchiveProduct && <Button size="sm" variant="danger" icon={<Archive size={13} />} onClick={() => setIsDeleteOpen(true)}>
              {isVi ? "Lưu trữ" : "Archive"}
            </Button>}
          </div>
        )}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ProductMetricCard
              icon={<Users size={18} />}
              label={isVi ? "Khách hàng sở hữu" : "Owning customers"}
              value={usageSummary.customersCount}
              hint={isVi ? "Số customer đã mua sản phẩm này" : "Customers who have purchased this product"}
            />
            <ProductMetricCard
              icon={<DollarSign size={18} />}
              label={isVi ? "Doanh thu ghi nhận" : "Recognized revenue"}
              value={formatVnd(usageSummary.wonRevenue, locale)}
              hint={isVi ? "Từ lịch sử customer ownership" : "Based on customer ownership history"}
            />
            <ProductMetricCard
              icon={<FileText size={18} />}
              label={isVi ? "Báo giá / đơn hàng" : "Quotes / orders"}
              value={`${usageSummary.quotesCount} / ${usageSummary.ordersCount}`}
              hint={isVi ? "Số giao dịch đang dùng sản phẩm" : "Transactions using this product"}
            />
            <ProductMetricCard
              icon={<CalendarClock size={18} />}
              label={isVi ? "Gia hạn sắp tới" : "Upcoming renewals"}
              value={usageSummary.upcomingRenewals}
              hint={isVi ? "Trong 30 ngày tới" : "Within the next 30 days"}
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ResponsiveTabs
              items={tabItems}
              activeId={activeTab}
              onChange={(id) => setActiveTab(id as ProductDetailTab)}
              className="bg-slate-50/80 px-2"
              overflowMode="dropdown"
              motionId="product-detail-tabs"
            />

            <div className="p-4 md:p-5">
              <RecordTabTransition transitionKey={activeTab} axis="x" minHeightClassName="min-h-[360px]" className="space-y-4">
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <RecordDetailSection title={isVi ? "Thông tin danh mục" : "Catalog information"}>
                    <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
                      <DetailField label={isVi ? "SKU" : "SKU"} value={product.sku} />
                      <DetailField label={isVi ? "Loại sản phẩm" : "Product type"} value={getProductTypeLabel(product.type, (key: string, fallback?: string) => fallback || key)} />
                      <DetailField label={isVi ? "Trạng thái" : "Status"} value={getProductStatusLabel(product.status, (key: string, fallback?: string) => fallback || key)} />
                      <DetailField label={isVi ? "Khả dụng" : "Availability"} value={availability?.status ?? projectionError ?? "…"} />
                      <DetailField label={isVi ? "Ngành / nhóm" : "Category"} value={product.category} />
                      <DetailField label={isVi ? "Đơn vị" : "Unit"} value={product.unit} />
                      <DetailField label={isVi ? "Chu kỳ tính phí" : "Billing cycle"} value={formatBillingCycle(product.billingCycle, (key: string, fallback?: string) => fallback || key)} />
                      <DetailField label={isVi ? "Tạo lúc" : "Created at"} value={product.createdAt.slice(0, 10)} />
                      <DetailField label={isVi ? "Cập nhật gần nhất" : "Last updated"} value={product.updatedAt.slice(0, 10)} />
                      <DetailField label={isVi ? "Thẻ gắn" : "Tags"} value={product.tags.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {product.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{tag}</span>
                          ))}
                        </div>
                      ) : "—"} />
                    </div>
                    {product.description ? (
                      <div className="border-t border-slate-100 px-5 py-4">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{isVi ? "Mô tả" : "Description"}</div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{product.description}</p>
                      </div>
                    ) : null}
                  </RecordDetailSection>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <RecordDetailSection title={isVi ? "Giá bán & biên lợi nhuận" : "Pricing & margin"}>
                      <div className="space-y-4 px-5 py-5">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <ProductPriceBlock product={product} size="lg" showTaxMode={true} />
                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <DetailField label={isVi ? "Giá niêm yết" : "List price"} value={formatProductPrice(product.listPrice, product.currency, locale)} />
                            <DetailField label={isVi ? "Tổng sau thuế" : "Total with tax"} value={authoritativeTotal} />
                            <DetailField label={isVi ? "Thuế" : "Tax"} value={`${product.taxRate}% (${product.taxMode})`} />
                            <DetailField label={isVi ? "Số tiền thuế" : "Tax amount"} value={authoritativeTaxAmount} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <DetailField label={isVi ? "Giá vốn" : "Cost price"} value={product.costPrice !== undefined ? formatVnd(product.costPrice, locale) : "—"} />
                          <DetailField label={isVi ? "Biên lợi nhuận" : "Margin"} value={analyzedMargin !== undefined ? `${analyzedMargin.toFixed(1)}%` : "—"} />
                        </div>
                      </div>
                    </RecordDetailSection>

                    <RecordDetailSection title={isVi ? "Thuê bao, bảo hành & vòng đời" : "Subscription, warranty & lifecycle"}>
                      <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2">
                        <DetailField label={isVi ? "Thuê bao" : "Subscription"} value={product.isSubscription ? (isVi ? "Có" : "Yes") : (isVi ? "Không" : "No")} />
                        <DetailField label={isVi ? "Có gia hạn" : "Renewable"} value={product.isRenewable ? (isVi ? "Có" : "Yes") : (isVi ? "Không" : "No")} />
                        <DetailField label={isVi ? "Bảo hành" : "Warranty"} value={product.warrantyMonths ? `${product.warrantyMonths} ${isVi ? "tháng" : "months"}` : "—"} />
                        <DetailField label={isVi ? "Hợp đồng mặc định" : "Default contract"} value={product.defaultContractMonths ? `${product.defaultContractMonths} ${isVi ? "tháng" : "months"}` : "—"} />
                        <DetailField label={isVi ? "Khách hàng tiềm năng quan tâm" : "Interested leads"} value={usageSummary.interestedLeads} />
                        <DetailField label={isVi ? "Cơ hội đang mở" : "Open deals"} value={usageSummary.openDeals} />
                      </div>
                    </RecordDetailSection>
                  </div>
                </div>
              )}

              {activeTab === "customers" && (
                <RecordDetailSection title={isVi ? "Khách hàng đã mua sản phẩm" : "Customers who purchased this product"}>
                  {purchasingCustomers.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Users size={28} />
                      </div>
                      <h3 className="mt-4 text-sm font-extrabold text-slate-900">{isVi ? "Chưa có customer nào sở hữu" : "No owning customers yet"}</h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">{isVi ? "Khi sản phẩm được bán qua quote hoặc order và gắn vào hồ sơ customer, danh sách này sẽ xuất hiện ở đây." : "Once this product is sold and attached to customer ownership, the list will appear here."}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-5 py-3 font-bold">{isVi ? "Customer" : "Customer"}</th>
                            <th className="px-5 py-3 font-bold">{isVi ? "Loại" : "Type"}</th>
                            <th className="px-5 py-3 font-bold">{isVi ? "Số dòng sở hữu" : "Owned lines"}</th>
                            <th className="px-5 py-3 font-bold">{isVi ? "Ngày mua gần nhất" : "Latest purchase"}</th>
                            <th className="px-5 py-3 font-bold text-right">{isVi ? "Doanh thu" : "Revenue"}</th>
                            <th className="px-5 py-3 font-bold">{isVi ? "Trạng thái" : "Status"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {purchasingCustomers.map((row) => (
                            <tr key={row.customer.id} className="hover:bg-slate-50/70">
                              <td className="px-5 py-4 align-top">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/customers/${row.customer.id}`)}
                                  className="text-left"
                                >
                                  <div className="font-bold text-slate-900 hover:text-indigo-600">{row.model.identity.displayName}</div>
                                  <div className="mt-1 text-xs text-slate-500">{row.customer.customerCode}</div>
                                </button>
                              </td>
                              <td className="px-5 py-4 align-top text-slate-600">{row.customer.type}</td>
                              <td className="px-5 py-4 align-top">
                                <div className="space-y-1">
                                  <div className="font-semibold text-slate-800">{row.ownedLines.length}</div>
                                  <div className="text-xs text-slate-500">
                                    {row.ownedLines.reduce((sum, line) => sum + (line.quantity ?? 1), 0)} {isVi ? "đơn vị" : "units"}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 align-top text-slate-600">{row.latestPurchaseAt?.slice(0, 10) || "—"}</td>
                              <td className="px-5 py-4 align-top text-right font-mono font-bold text-violet-700">{formatVnd(row.totalAmount, locale)}</td>
                              <td className="px-5 py-4 align-top">
                                <div className="flex flex-wrap gap-1">
                                  {row.ownedLines.slice(0, 2).map((line) => {
                                    const display = getOwnedProductDisplay(line, [product]);
                                    return (
                                      <span key={line.id} className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                                        {String(display.status).toUpperCase()}
                                      </span>
                                    );
                                  })}
                                  {row.ownedLines.length > 2 && (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">+{row.ownedLines.length - 2}</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </RecordDetailSection>
              )}

              {activeTab === "commercial" && (
                <div className="space-y-4">
                  <RecordDetailSection title={isVi ? "Dùng trong cơ hội bán hàng" : "Used in sales opportunities"}>
                    <div className="grid grid-cols-1 gap-4 px-5 py-5 lg:grid-cols-3">
                      <DetailField label={isVi ? "Khách hàng tiềm năng quan tâm" : "Interested leads"} value={usageSummary.interestedLeads} />
                      <DetailField label={isVi ? "Cơ hội đang mở" : "Open deals"} value={usageSummary.openDeals} />
                      <DetailField label={isVi ? "Quotes liên quan" : "Related quotes"} value={linkedQuotes.length} />
                    </div>
                    <div className="border-t border-slate-100 px-5 py-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900">{isVi ? "Deals" : "Deals"}</h3>
                          <div className="mt-3 space-y-2">
                            {linkedDeals.length === 0 ? (
                              <p className="text-xs text-slate-500">{isVi ? "Chưa có deal nào liên kết." : "No linked deals."}</p>
                            ) : linkedDeals.slice(0, 6).map((deal: any) => (
                              <div key={deal.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="font-bold text-slate-800">{deal.name}</div>
                                <div className="mt-1 text-xs text-slate-500">{deal.stage || "—"} • {formatVnd(deal.amount || 0, locale)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900">{isVi ? "Quotes & Orders" : "Quotes & Orders"}</h3>
                          <div className="mt-3 space-y-2">
                            {[...linkedQuotes.slice(0, 3).map((quote: any) => ({
                              id: quote.id,
                              label: quote.quoteNumber || quote.name || quote.id,
                              subLabel: `${isVi ? "Quote" : "Quote"} • ${formatVnd(quote.grandTotal || quote.total || 0, locale)}`,
                            })), ...linkedOrders.slice(0, 3).map((order: any) => ({
                              id: order.id,
                              label: order.orderNumber || order.id,
                              subLabel: `${isVi ? "Order" : "Order"} • ${formatVnd(order.grandTotal || order.totalAmount || 0, locale)}`,
                            }))].length === 0 ? (
                              <p className="text-xs text-slate-500">{isVi ? "Chưa có quote hoặc order nào liên kết." : "No linked quotes or orders."}</p>
                            ) : (
                              [...linkedQuotes.slice(0, 3).map((quote: any) => ({
                                id: quote.id,
                                label: quote.quoteNumber || quote.name || quote.id,
                                subLabel: `${isVi ? "Quote" : "Quote"} • ${formatVnd(quote.grandTotal || quote.total || 0, locale)}`,
                              })), ...linkedOrders.slice(0, 3).map((order: any) => ({
                                id: order.id,
                                label: order.orderNumber || order.id,
                                subLabel: `${isVi ? "Order" : "Order"} • ${formatVnd(order.grandTotal || order.totalAmount || 0, locale)}`,
                              }))].map((item) => (
                                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="font-bold text-slate-800">{item.label}</div>
                                  <div className="mt-1 text-xs text-slate-500">{item.subLabel}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </RecordDetailSection>
                </div>
              )}

              {activeTab === "activity" && (
                <RecordDetailSection title={isVi ? "Dòng thời gian danh mục" : "Catalog activity timeline"}>
                  <div className="space-y-3 px-5 py-5">
                    {[
                      {
                        title: isVi ? "Sản phẩm được tạo" : "Product created",
                        detail: product.createdAt,
                      },
                      {
                        title: isVi ? "Cập nhật danh mục gần nhất" : "Last catalog update",
                        detail: product.updatedAt,
                      },
                      {
                        title: isVi ? "Đơn hàng gần nhất sử dụng sản phẩm" : "Latest order using this product",
                        detail: linkedOrders[0]?.createdAt || linkedOrders[0]?.orderDate || "—",
                      },
                      {
                        title: isVi ? "Customer mua gần nhất" : "Latest purchasing customer",
                        detail: purchasingCustomers[0]?.latestPurchaseAt || "—",
                      },
                    ].map((item, index) => (
                      <div key={`${item.title}-${index}`} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
                          <CheckCircle2 size={15} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{item.title}</div>
                          <div className="mt-1 text-xs font-medium text-slate-500">{String(item.detail).replace("T", " ").slice(0, 16)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </RecordDetailSection>
              )}
              </RecordTabTransition>
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-1">
          <RecordDetailSection title={isVi ? "Tóm tắt điều hành" : "Executive summary"}>
            <div className="space-y-4 px-5 py-5">
              <DetailField label={isVi ? "Giá bán hiện tại" : "Current list price"} value={<span className="text-base font-black text-violet-700">{formatProductPrice(product.listPrice, product.currency, locale)}</span>} />
              <DetailField label={isVi ? "Trạng thái catalog" : "Catalog status"} value={<ProductStatusBadge status={product.status} />} />
              <DetailField label={isVi ? "Đối tượng bán" : "Catalog segment"} value={product.category} />
              <DetailField label={isVi ? "Doanh thu đã ghi nhận" : "Recognized revenue"} value={formatVnd(usageSummary.wonRevenue, locale)} />
              <DetailField label={isVi ? "Khuyến nghị" : "Recommendation"} value={usageSummary.customersCount > 0
                ? (isVi ? "Nên giữ trang Product trong CRM vì sản phẩm đang gắn trực tiếp với customer ownership và giao dịch." : "Keep the Product page in CRM because the catalog is directly linked to customer ownership and commercial transactions.")
                : (isVi ? "Trang Product vẫn cần thiết để chuẩn hóa quote, order và hỗ trợ mở rộng cross-sell / upsell sau này." : "The Product page remains useful to standardize quotes, orders and future cross-sell / upsell flows.")}
              />
            </div>
          </RecordDetailSection>

          <RecordDetailSection title={isVi ? "Tác động CRM" : "CRM impact"}>
            <div className="space-y-3 px-5 py-5">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{isVi ? "Phạm vi sử dụng" : "Usage scope"}</div>
                <ul className="mt-2 space-y-2 text-sm font-medium text-slate-700">
                  <li>• {isVi ? `Khách hàng tiềm năng quan tâm: ${usageSummary.interestedLeads}` : `Interested leads: ${usageSummary.interestedLeads}`}</li>
                  <li>• {isVi ? `Cơ hội đang mở: ${usageSummary.openDeals}` : `Open deals: ${usageSummary.openDeals}`}</li>
                  <li>• {isVi ? `Báo giá: ${usageSummary.quotesCount}` : `Báo giá: ${usageSummary.quotesCount}`}</li>
                  <li>• {isVi ? `Đơn hàng: ${usageSummary.ordersCount}` : `Đơn hàng: ${usageSummary.ordersCount}`}</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-500">
                {isVi
                  ? "Thiết kế mới bám theo archetype của Customer Detail: có header bản ghi, tab nội dung, khung thông tin chính và danh sách customer đã mua sản phẩm."
                  : "The redesign follows the Customer Detail archetype: record header, content tabs, insight panels and a dedicated list of customers who purchased the product."}
              </div>
            </div>
          </RecordDetailSection>
        </div>
      </div>

      <ProductFormModal
        id="product-detail-form-modal"
        isOpen={isFormOpen}
        product={activeFormProduct ?? undefined}
        onClose={() => {
          setIsFormOpen(false);
          setActiveFormProduct(null);
        }}
        onSubmit={handleFormSubmit}
        existingProducts={products}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={isVi ? "Lưu trữ sản phẩm này?" : "Archive this product?"}
        message={isVi
          ? "Sản phẩm sẽ được lưu trữ. Customer ownership, quote, order, deal và lịch sử giao dịch vẫn được giữ lại."
          : "The product will be archived. Customer ownership, quotes, orders, deals and transaction history remain retained."}
        confirmText={isVi ? "Lưu trữ" : "Archive"}
        cancelText={isVi ? "Hủy" : "Cancel"}
        type="danger"
      />
    </RecordDetailFrame>
  );
};
