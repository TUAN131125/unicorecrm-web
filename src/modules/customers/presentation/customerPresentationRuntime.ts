import { subscribeToPurchaseEvidence } from "@/modules/commercial-evidence";
import { subscribeToContacts } from "@/modules/contacts";
import { subscribeToOrders } from "@/modules/orders";
import { subscribeToOrganizationAccounts } from "@/modules/organizations";
import { subscribeToCustomers } from "../public/api";
import { getCustomerPresentationSnapshot } from "./model/customerPresentation";

export { getCustomerPresentationSnapshot } from "./model/customerPresentation";

export function subscribeToCustomerPresentation(listener: (customers: ReturnType<typeof getCustomerPresentationSnapshot>) => void): () => void {
  const notify = () => listener(getCustomerPresentationSnapshot());
  const unsubscribers = [
    subscribeToCustomers(notify),
    subscribeToContacts(notify),
    subscribeToOrganizationAccounts(notify),
    subscribeToPurchaseEvidence(notify),
    subscribeToOrders(notify),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
