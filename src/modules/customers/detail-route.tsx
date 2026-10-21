import React from "react";
import { useParams } from "react-router-dom";
import { getAllCustomerCareCardsSnapshot, getCustomerSnapshot, replaceCustomerSnapshot, subscribeToCustomerRepository } from "./public/api";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary, useEffectiveAccess } from "@/platform/access-control";
import { createAuthoritativeResource } from "@/shared/application";
import { AuthoritativeQueryBoundary, useModuleAuthoritativeResource } from "@/shared/operations";
import { getCustomer360Resource } from "./application/vertical-slice/customerAuthoritativeQueries";
import { getCustomerApiRuntime, isCustomerConnectedApiRuntime } from "./application/composition/customerApplicationServices";
import { Customer360Page } from "./presentation/pages/Customer360Page";
import { CustomerConnectedWorkspace } from "./presentation/detail/CustomerConnectedWorkspace";

const CustomerDetailContent: React.FC = () => {
  const { customerId = "" } = useParams();
  const workspace = useWorkspaceContextSnapshot();
  const connected = isCustomerConnectedApiRuntime();
  // The authority-keyed route owns the connected projection; it never shares a 360
  // cache with another membership/session or publishes retired data to demo snapshots.
  const resource = React.useMemo(() => connected
    ? createAuthoritativeResource(signal => getCustomerApiRuntime().queries.get360(customerId, signal), { shouldRetainDataOnError: () => false })
    : getCustomer360Resource(customerId || "__missing__"), [connected, customerId]);
  React.useEffect(() => () => { if (connected) resource.reset(); }, [connected, resource]);
  const detailQuery = useModuleAuthoritativeResource(resource, {
    enabled: Boolean(customerId),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceCustomerSnapshot({ customers: [], careCards: getAllCustomerCareCardsSnapshot() }),
  });
  const demoCustomer = useSubscribableSnapshot(
    () => connected ? undefined : getCustomerSnapshot(customerId),
    (listener) => connected ? () => {} : subscribeToCustomerRepository(() => listener(getCustomerSnapshot(customerId))),
  );
  const projection = connected && !detailQuery.error ? detailQuery.data : undefined;
  const customer = connected ? projection?.customer : demoCustomer;
  return (
    <AuthoritativeQueryBoundary
      query={detailQuery}
      hasData={Boolean(customer) && (!connected || !detailQuery.error)}
      loadingTitleVi="Đang tải Customer 360 từ backend"
      loadingTitleEn="Loading Customer 360 from backend"
      errorTitleVi="Không thể tải Customer 360"
      errorTitleEn="Customer 360 could not be loaded"
    >
      {customer
        ? projection ? <CustomerConnectedWorkspace projection={projection}/> : <Customer360Page customer={customer} />
        : <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">Customer not found.</div>}
    </AuthoritativeQueryBoundary>
  );
};

export const CustomerDetailRoutePage: React.FC = () => {
  const { customerId = "" } = useParams();
  const access = useEffectiveAccess();
  const session = useAuthSessionSnapshot();
  const authorityKey = JSON.stringify([access.workspaceId, access.accountId, access.membershipId, access.authorityRevision, session?.sessionId]);
  return (
    <EffectiveRecordAccessBoundary key={`${authorityKey}:${customerId}`} resourceKey="customers" recordId={customerId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.customers}
      requestedFields={[...EFFECTIVE_RECORD_ACCESS_PROFILES.customers.requestedFields, "customerCode", "type", "tags", "tier", "serviceLevel", "careCadenceDays", "onboardingStatus", "nextCareAt", "lastCareAt"]}>
      <CustomerDetailContent />
    </EffectiveRecordAccessBoundary>
  );
};
