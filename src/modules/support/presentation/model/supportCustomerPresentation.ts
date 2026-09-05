import { getCustomerSnapshot } from "@/modules/customers";
import { projectCustomerForPresentation } from "@/modules/customers";
import type { SupportCase } from "../../domain/model/supportCase.types";

/** Rendered when a Support Case carries no Customer enrichment at all. */
const NO_CUSTOMER_LABEL = "—";

export function resolveSupportCustomerName(
  supportCase: Pick<SupportCase, "customerId" | "customerName">,
): string {
  // Customer enrichment is optional. A Customer aggregate exists only once effective purchase
  // evidence has been recorded, so a case raised against a pre-purchase Contact or Organization
  // Account has no customerId and no customerName. Fall back to the neutral placeholder rather
  // than substituting the relationship identifier, which is not a customer display name.
  if (!supportCase.customerId) return supportCase.customerName || NO_CUSTOMER_LABEL;
  const customer = getCustomerSnapshot(supportCase.customerId);
  if (!customer) return supportCase.customerName || supportCase.customerId;
  return projectCustomerForPresentation(customer).displayName;
}
