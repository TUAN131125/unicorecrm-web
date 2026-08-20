import React from "react";
import { useParams } from "react-router-dom";
import { getProductCatalogSnapshot, subscribeToProductCatalog } from "@/modules/products";
import { useSubscribableSnapshot } from "@/platform/react";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { OrderFormPage as OrderFormScreen } from "./presentation/pages/OrderFormPage";
import { useOrderReferences } from "./route-context";

export const OrderFormRoutePage: React.FC = () => {
  const { orderId = "" } = useParams();
  const references = useOrderReferences();
  const products = useSubscribableSnapshot(getProductCatalogSnapshot, subscribeToProductCatalog);
  const requiredCommand = orderId ? "order.update" : "order.create";
  return (
    <EffectiveRecordAccessBoundary
      resourceKey="orders"
      recordId={orderId || undefined}
      requiredCommand={requiredCommand}
      {...EFFECTIVE_RECORD_ACCESS_PROFILES.orders}
    >
      <OrderFormScreen {...references} products={products} />
    </EffectiveRecordAccessBoundary>
  );
};
