import React from "react";
import { useParams } from "react-router-dom";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { AuthoritativeQueryBoundary, useModuleAuthoritativeResource } from "@/shared/operations";
import { getOrganizationAccountDetailResource } from "./application/vertical-slice/organizationAuthoritativeQueries";
import {
  getOrganizationAccountsSnapshot,
  replaceOrganizationAccounts,
  subscribeToOrganizationAccounts,
} from "./public/api";
import { OrganizationAccountDetailPage as OrganizationDetailScreen } from "./presentation/pages/OrganizationAccountDetailPage";

const OrganizationAccountDetailContent: React.FC<{ recordId: string }> = ({ recordId }) => {
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(
    getOrganizationAccountDetailResource(recordId || "__missing__"),
    {
      enabled: Boolean(recordId),
      scopeKey: workspace.workspaceId,
      onScopeChange: () => replaceOrganizationAccounts([]),
    },
  );
  const accounts = useSubscribableSnapshot(
    getOrganizationAccountsSnapshot,
    subscribeToOrganizationAccounts,
  );

  return (
    <AuthoritativeQueryBoundary
      query={detailQuery}
      hasData={accounts.some((account) => account.id === recordId)}
      loadingTitleVi="Đang tải tổ chức từ backend"
      loadingTitleEn="Loading organization from backend"
      errorTitleVi="Không thể tải tổ chức"
      errorTitleEn="Organization could not be loaded"
    >
      <OrganizationDetailScreen />
    </AuthoritativeQueryBoundary>
  );
};

export const OrganizationAccountDetailPage: React.FC = () => {
  const { organizationId = "", organizationAccountId = "" } = useParams();
  const recordId = organizationId || organizationAccountId;
  return (
    <EffectiveRecordAccessBoundary resourceKey="organizations" recordId={recordId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.organizations}>
      <OrganizationAccountDetailContent recordId={recordId} />
    </EffectiveRecordAccessBoundary>
  );
};
