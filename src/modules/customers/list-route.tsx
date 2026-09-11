import React from "react";
import { CustomerListPage } from "./presentation/pages/CustomerListPage";

/** Connected data loading is owned by CustomerListPage/useCustomers; demo remains repository-backed. */
export const CustomerListRoutePage: React.FC = () => <CustomerListPage />;
