import React from "react";
import { useParams } from "react-router-dom";
import { OrderDetailPage as OrderDetailScreen } from "./presentation/pages/OrderDetailPage";
import { useOrderReferences } from "./route-context";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";

export const OrderDetailRoutePage: React.FC = () => {
  const { orderId = "" } = useParams();
  const references = useOrderReferences();
  return (
    <EffectiveRecordAccessBoundary resourceKey="orders" recordId={orderId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.orders}>
      <OrderDetailScreen {...references} />
    </EffectiveRecordAccessBoundary>
  );
};
