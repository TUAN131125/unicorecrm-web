import React from "react";
import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import { getCustomersSnapshot, subscribeToCustomers } from "./public/api";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getOrderListSnapshot, subscribeToOrderList } from "@/modules/orders";
import { getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts } from "@/modules/organizations";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import { getSupportCasesSnapshot, subscribeToSupportCases } from "@/modules/support";
import { getTaskActivitySnapshot, subscribeToTaskActivity } from "@/modules/tasks";
import { useSubscribableSnapshot } from "@/platform/react";
import { CustomerListPage } from "./presentation/pages/CustomerListPage";

export const CustomerListRoutePage: React.FC = () => {
  const customers = useSubscribableSnapshot(getCustomersSnapshot, subscribeToCustomers);
  const refreshToken = [
    useSubscribableSnapshot(getContactsSnapshot, subscribeToContacts),
    useSubscribableSnapshot(getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts),
    useSubscribableSnapshot(getDealsSnapshot, subscribeToDeals),
    useSubscribableSnapshot(getQuotesSnapshot, subscribeToQuotes),
    useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList),
    useSubscribableSnapshot(getSupportCasesSnapshot, subscribeToSupportCases),
    useSubscribableSnapshot(getTaskActivitySnapshot, subscribeToTaskActivity),
  ];
  return <CustomerListPage customers={customers} refreshToken={refreshToken} />;
};
