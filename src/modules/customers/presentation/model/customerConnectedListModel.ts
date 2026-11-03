import type { Customer } from "../../domain/model/customer.types";
import type { CustomerListItem } from "../../application/ports/CustomerApiRuntime";
import type { Customer360ReadModel } from "./customer360ReadModel.types";

export function buildConnectedCustomerListModel(customer: Customer, identity: CustomerListItem["listIdentity"], isVi: boolean): Customer360ReadModel {
  return {
    customer,
    identity: { displayName: identity?.displayName || (isVi ? "Chưa có tên được phép xem" : "Permitted name unavailable"), ownerId: customer.ownerId ?? undefined, contacts: [] },
    leads: [], deals: [], quotes: [], orders: [], paymentObligations: [], paymentTransactions: [], invoices: [], receivables: [],
    shippingBookings: [], returns: [], returnIntents: [], supportCases: [], tasks: [], activities: [], careCards: [], purchaseEvidence: [], timeline: [],
    metrics: {},
    integrity: { status: "UNKNOWN" },
    productsPurchased: [],
  };
}
