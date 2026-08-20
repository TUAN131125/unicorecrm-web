import { getCustomerSnapshot } from "@/modules/customers";
import { projectCustomerForPresentation } from "@/modules/customers";
import type { SupportCase } from "../../domain/model/supportCase.types";

export function resolveSupportCustomerName(
  supportCase: Pick<SupportCase, "customerId" | "customerName">,
): string {
  const customer = getCustomerSnapshot(supportCase.customerId);
  if (!customer) return supportCase.customerName || supportCase.customerId;
  return projectCustomerForPresentation(customer).displayName;
}
