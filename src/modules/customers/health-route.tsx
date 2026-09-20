import React from "react";
import { CustomerHealthPage } from "./presentation/pages/CustomerHealthPage";
import { useCustomers } from "./presentation/hooks/useCustomers";
import { isCustomerConnectedApiRuntime } from "./application/composition/customerApplicationServices";

export const CustomerHealthRoutePage: React.FC = () => {
  const source = useCustomers({ loadAuthoritative: true });
  return <CustomerHealthPage customers={source.customers} connected={isCustomerConnectedApiRuntime()} />;
};
