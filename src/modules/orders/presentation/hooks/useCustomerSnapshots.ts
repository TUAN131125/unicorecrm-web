import { useEffect, useState } from "react";
import type { CustomerDisplay } from "@/modules/customers";
import { getCustomerPresentationSnapshot as getCustomersSnapshot, subscribeToCustomerPresentation as subscribeToCustomers } from "@/modules/customers";

export function useCustomerSnapshots(): CustomerDisplay[] {
  const [customers, setCustomers] = useState<CustomerDisplay[]>(() => getCustomersSnapshot());
  useEffect(() => subscribeToCustomers(setCustomers), []);
  return customers;
}
