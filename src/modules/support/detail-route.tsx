import React from "react";
import { useParams } from "react-router-dom";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { AuthoritativeQueryBoundary, useModuleAuthoritativeResource } from "@/shared/operations";
import { getSupportCaseDetailResource } from "./application/vertical-slice/supportAuthoritativeQueries";
import { getSupportCasesSnapshot, replaceSupportCases, subscribeToSupportCases } from "./public/cases";
import { SupportCaseDetailPage as SupportCaseDetailScreen } from "./presentation/pages/SupportCaseDetailPage";
import { useSupportReferences } from "./route-context";

const SupportCaseDetailContent: React.FC = () => {
  const { caseId = "", supportCaseId = "" } = useParams();
  const recordId = caseId || supportCaseId;
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(getSupportCaseDetailResource(recordId || "__missing__"), {
    enabled: Boolean(recordId),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceSupportCases([]),
  });
  const cases = useSubscribableSnapshot(getSupportCasesSnapshot, subscribeToSupportCases);
  const references = useSupportReferences();
  return (
    <AuthoritativeQueryBoundary
      query={detailQuery}
      hasData={cases.some((item) => item.id === recordId)}
      loadingTitleVi="Đang tải phiếu hỗ trợ từ backend"
      loadingTitleEn="Loading support ticket from backend"
      errorTitleVi="Không thể tải phiếu hỗ trợ"
      errorTitleEn="Support ticket could not be loaded"
    >
      <SupportCaseDetailScreen {...references} />
    </AuthoritativeQueryBoundary>
  );
};

export const SupportCaseDetailRoutePage: React.FC = () => {
  const { caseId = "", supportCaseId = "" } = useParams();
  const recordId = caseId || supportCaseId;
  return (
    <EffectiveRecordAccessBoundary resourceKey="support" recordId={recordId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.support}>
      <SupportCaseDetailContent />
    </EffectiveRecordAccessBoundary>
  );
};
