import React from "react";
import { getCustomerPresentationSnapshot as getCustomersSnapshot, subscribeToCustomerPresentation as subscribeToCustomers } from "@/modules/customers";
import { useSubscribableSnapshot } from "@/platform/react";
import { QuoteListPage as QuoteListScreen } from "./presentation/pages/QuoteListPage";

export const QuoteListRoutePage: React.FC = () => {
  const customers = useSubscribableSnapshot(getCustomersSnapshot, subscribeToCustomers);
  return <QuoteListScreen customers={customers} />;
};
