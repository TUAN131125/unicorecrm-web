import React from "react";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { useParams } from "react-router-dom";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary, useEffectiveAccess } from "@/platform/access-control";
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
  const access = useEffectiveAccess();
  const session = useAuthSessionSnapshot();
  const authorityKey = JSON.stringify([access.workspaceId, access.accountId, access.membershipId, access.authorityRevision, session?.sessionId]);
  return (
    <EffectiveRecordAccessBoundary key={`${authorityKey}:${recordId}`} resourceKey="organizations" recordId={recordId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.organizations}
      requestedFields={[...EFFECTIVE_RECORD_ACCESS_PROFILES.organizations.requestedFields, "displayName", "contactRefs", "notes", "domain", "website", "sizeBand", "employeeCount", "annualRevenue", "email", "phone", "address", "source", "relationshipLevel"]}>
      <OrganizationAccountDetailContent recordId={recordId} />
    </EffectiveRecordAccessBoundary>
  );
};
