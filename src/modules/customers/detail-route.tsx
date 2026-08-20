import React from "react";
import { useParams } from "react-router-dom";
import { getPurchaseEvidenceListSnapshot, subscribeToPurchaseEvidence } from "@/modules/commercial-evidence";
import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import { getCustomerSnapshot, getAllCustomerCareCardsSnapshot, replaceCustomerSnapshot, subscribeToCustomerRepository } from "./public/api";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getOrderListSnapshot, subscribeToOrderList } from "@/modules/orders";
import { getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts } from "@/modules/organizations";
import { getPaymentsSnapshot, subscribeToPayments } from "@/modules/payments";
import { getInvoicesSnapshot, subscribeToInvoices } from "@/modules/invoices";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import { getReturnsSnapshot, subscribeToReturns } from "@/modules/returns";
import { getShippingSnapshot, subscribeToShipping } from "@/modules/shipping";
import { getSupportCasesSnapshot, subscribeToSupportCases } from "@/modules/support";
import { getTaskActivitySnapshot, subscribeToTaskActivity } from "@/modules/tasks";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary } from "@/platform/access-control";
import { AuthoritativeQueryBoundary, useModuleAuthoritativeResource } from "@/shared/operations";
import { getCustomerDetailResource } from "./application/vertical-slice/customerAuthoritativeQueries";
import { Customer360Page } from "./presentation/pages/Customer360Page";

const CustomerDetailContent: React.FC = () => {
  const { customerId = "" } = useParams();
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(getCustomerDetailResource(customerId || "__missing__"), {
    enabled: Boolean(customerId),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceCustomerSnapshot({ customers: [], careCards: getAllCustomerCareCardsSnapshot() }),
  });
  const customerSnapshot = useSubscribableSnapshot(() => getCustomerSnapshot(customerId), (listener) => subscribeToCustomerRepository(() => listener(getCustomerSnapshot(customerId))));
  const refreshToken = [
    useSubscribableSnapshot(getContactsSnapshot, subscribeToContacts),
    useSubscribableSnapshot(getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts),
    useSubscribableSnapshot(getDealsSnapshot, subscribeToDeals),
    useSubscribableSnapshot(getQuotesSnapshot, subscribeToQuotes),
    useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList),
    useSubscribableSnapshot(getPaymentsSnapshot, subscribeToPayments),
    useSubscribableSnapshot(getInvoicesSnapshot, subscribeToInvoices),
    useSubscribableSnapshot(getShippingSnapshot, subscribeToShipping),
    useSubscribableSnapshot(getReturnsSnapshot, subscribeToReturns),
    useSubscribableSnapshot(getSupportCasesSnapshot, subscribeToSupportCases),
    useSubscribableSnapshot(getTaskActivitySnapshot, subscribeToTaskActivity),
    useSubscribableSnapshot(getPurchaseEvidenceListSnapshot, (listener) => subscribeToPurchaseEvidence(() => listener(getPurchaseEvidenceListSnapshot()))),
  ];
  return (
    <AuthoritativeQueryBoundary
      query={detailQuery}
      hasData={Boolean(customerSnapshot)}
      loadingTitleVi="Đang tải Customer từ backend"
      loadingTitleEn="Loading Customer from backend"
      errorTitleVi="Không thể tải Customer"
      errorTitleEn="Customer could not be loaded"
    >
      {customerSnapshot
        ? <Customer360Page customer={customerSnapshot} refreshToken={refreshToken} />
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
