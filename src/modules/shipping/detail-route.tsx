import React from "react";
import { useParams } from "react-router-dom";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { AuthoritativeQueryBoundary, useModuleAuthoritativeResource } from "@/shared/operations";
import { getShippingBookingDetailResource } from "./application/vertical-slice/shippingAuthoritativeQueries";
import { getShippingSnapshot, replaceShippingSnapshot, subscribeToShipping } from "./public/api";
import { ShippingBookingDetailPage as ShippingBookingDetailScreen } from "./presentation/pages/ShippingBookingDetailPage";

const ShippingBookingDetailContent: React.FC = () => {
  const { shippingBookingId = "" } = useParams();
  const recordId = shippingBookingId;
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(getShippingBookingDetailResource(recordId || "__missing__"), {
    enabled: Boolean(recordId),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceShippingSnapshot([]),
  });
  const records = useSubscribableSnapshot(getShippingSnapshot, subscribeToShipping);
  return (
    <AuthoritativeQueryBoundary
      query={detailQuery}
      hasData={records.some((item) => item.id === recordId)}
      loadingTitleVi="Đang tải vận đơn từ backend"
      loadingTitleEn="Loading shipping booking from backend"
      errorTitleVi="Không thể tải vận đơn"
      errorTitleEn="Shipping booking could not be loaded"
    >
      <ShippingBookingDetailScreen />
    </AuthoritativeQueryBoundary>
  );
};

export const ShippingBookingDetailPage: React.FC = () => {
  const { shippingBookingId = "" } = useParams();
  const recordId = shippingBookingId;
  return (
    <EffectiveRecordAccessBoundary resourceKey="shipping" recordId={recordId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.shipping}>
      <ShippingBookingDetailContent />
    </EffectiveRecordAccessBoundary>
  );
};
