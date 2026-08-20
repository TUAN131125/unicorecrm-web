import React from "react";
import { ProductListPage as ProductListScreen } from "./presentation/pages/ProductListPage";
import { useProductUsageSources } from "./route-context";

export const ProductListRoutePage: React.FC = () => {
  const sources = useProductUsageSources();
  return <ProductListScreen {...sources} />;
};
