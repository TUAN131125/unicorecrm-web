import React from "react";
import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import { getCustomersSnapshot, subscribeToCustomers } from "./public/api";
import { getOrderListSnapshot, subscribeToOrderList } from "@/modules/orders";
import { getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts } from "@/modules/organizations";
import { getSupportCasesSnapshot, subscribeToSupportCases } from "@/modules/support";
import { getTaskActivitySnapshot, subscribeToTaskActivity } from "@/modules/tasks";
import { useSubscribableSnapshot } from "@/platform/react";
import { CustomerHealthPage } from "./presentation/pages/CustomerHealthPage";

export const CustomerHealthRoutePage: React.FC = () => {
  const customers = useSubscribableSnapshot(getCustomersSnapshot, subscribeToCustomers);
  const refreshToken = [useSubscribableSnapshot(getContactsSnapshot, subscribeToContacts), useSubscribableSnapshot(getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts), useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList), useSubscribableSnapshot(getSupportCasesSnapshot, subscribeToSupportCases), useSubscribableSnapshot(getTaskActivitySnapshot, subscribeToTaskActivity)];
  return <CustomerHealthPage customers={customers} refreshToken={refreshToken} />;
};
