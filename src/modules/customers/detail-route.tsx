import React from "react";
import { useParams } from "react-router-dom";
import { getAllCustomerCareCardsSnapshot, getCustomerSnapshot, replaceCustomerSnapshot, subscribeToCustomerRepository } from "./public/api";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { AuthoritativeQueryBoundary, useModuleAuthoritativeResource } from "@/shared/operations";
import { getCustomer360Resource } from "./application/vertical-slice/customerAuthoritativeQueries";
import { isCustomerConnectedApiRuntime } from "./application/composition/customerApplicationServices";
import { Customer360Page } from "./presentation/pages/Customer360Page";

const CustomerDetailContent: React.FC = () => {
  const { customerId = "" } = useParams();
  const workspace = useWorkspaceContextSnapshot();
  const connected = isCustomerConnectedApiRuntime();
  const detailQuery = useModuleAuthoritativeResource(getCustomer360Resource(customerId || "__missing__"), {
    enabled: Boolean(customerId),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceCustomerSnapshot({ customers: [], careCards: getAllCustomerCareCardsSnapshot() }),
  });
  const demoCustomer = useSubscribableSnapshot(
    () => getCustomerSnapshot(customerId),
    (listener) => subscribeToCustomerRepository(() => listener(getCustomerSnapshot(customerId))),
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
        ? <Customer360Page customer={customer} authoritativeProjection={projection} />
        : <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">Customer not found.</div>}
    </AuthoritativeQueryBoundary>
  );
};

export const CustomerDetailRoutePage: React.FC = () => {
  const { customerId = "" } = useParams();
  return (
    <EffectiveRecordAccessBoundary resourceKey="customers" recordId={customerId} {...EFFECTIVE_RECORD_ACCESS_PROFILES.customers}>
      <CustomerDetailContent />
    </EffectiveRecordAccessBoundary>
  );
};
