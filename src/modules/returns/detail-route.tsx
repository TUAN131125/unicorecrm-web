import React from "react";
import { useParams } from "react-router-dom";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { AuthoritativeQueryBoundary, useModuleAuthoritativeResource } from "@/shared/operations";
import { getReturnDetailResource } from "./application/vertical-slice/returnAuthoritativeQueries";
import { getReturnsSnapshot, replaceReturnsSnapshot, subscribeToReturns } from "./public/api";
import { ReturnDetailPage as ReturnDetailScreen } from "./presentation/pages/ReturnDetailPage";

const ReturnDetailContent: React.FC = () => {
  const { returnId = "" } = useParams();
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(getReturnDetailResource(returnId || "__missing__"), {
    enabled: Boolean(returnId),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceReturnsSnapshot({ requests: [], intents: getReturnsSnapshot().intents }),
  });
  const snapshot = useSubscribableSnapshot(getReturnsSnapshot, subscribeToReturns);
  return (
    <AuthoritativeQueryBoundary
      query={detailQuery}
      hasData={snapshot.requests.some((item) => item.id === returnId)}
      loadingTitleVi="Đang tải yêu cầu trả hàng từ backend"
      loadingTitleEn="Loading return request from backend"
      errorTitleVi="Không thể tải yêu cầu trả hàng"
      errorTitleEn="Return request could not be loaded"
    >
      <ReturnDetailScreen />
    </AuthoritativeQueryBoundary>
  );
};

export const ReturnDetailPage: React.FC = () => {
  const { returnId = "" } = useParams();
  return (
    <EffectiveRecordAccessBoundary resourceKey="returns" recordId={returnId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.returns}>
      <ReturnDetailContent />
    </EffectiveRecordAccessBoundary>
  );
};
