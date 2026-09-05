import React from "react";
import { useParams } from "react-router-dom";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { AuthoritativeQueryBoundary, useModuleAuthoritativeResource } from "@/shared/operations";
import { getProductDetailResource } from "./application/vertical-slice/productAuthoritativeQueries";
import { getProductCatalogSnapshot, replaceProductCatalog, subscribeToProductCatalog } from "./public/catalog";
import { ProductDetailPage as ProductDetailScreen } from "./presentation/pages/ProductDetailPage";
import { useProductUsageSources } from "./route-context";

const ProductDetailContent: React.FC = () => {
  const { productId = "" } = useParams();
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(getProductDetailResource(productId || "__missing__"), {
    enabled: Boolean(productId),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceProductCatalog([]),
  });
  const products = useSubscribableSnapshot(getProductCatalogSnapshot, subscribeToProductCatalog);
  const sources = useProductUsageSources();
  return (
    <AuthoritativeQueryBoundary
      query={detailQuery}
      hasData={products.some((item) => item.id === productId)}
      loadingTitleVi="Đang tải sản phẩm từ backend"
      loadingTitleEn="Loading product from backend"
      errorTitleVi="Không thể tải sản phẩm"
      errorTitleEn="Product could not be loaded"
    >
      <ProductDetailScreen {...sources} />
    </AuthoritativeQueryBoundary>
  );
};

export const ProductDetailRoutePage: React.FC = () => {
  return <ProductDetailContent />;
};
