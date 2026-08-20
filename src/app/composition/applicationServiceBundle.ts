import type { CommercialEvidenceApplicationServices } from "@/modules/commercial-evidence/application/composition/commercialEvidenceApplicationServices";
import type { ContactApplicationServices } from "@/modules/contacts/application/composition/contactApplicationServices";
import type { CustomerApplicationServices } from "@/modules/customers/application/composition/customerApplicationServices";
import type { DealApplicationServices } from "@/modules/deals/application/composition/dealApplicationServices";
import type { InvoiceApplicationServices } from "@/modules/invoices/application/composition/invoiceApplicationServices";
import type { LeadApplicationServices } from "@/modules/leads/application/composition/leadApplicationServices";
import type { OrderApplicationServices } from "@/modules/orders/application/composition/orderApplicationServices";
import type { OrganizationApplicationServices } from "@/modules/organizations/application/composition/organizationApplicationServices";
import type { PaymentApplicationServices } from "@/modules/payments/application/composition/paymentApplicationServices";
import type { ProductApplicationServices } from "@/modules/products/application/composition/productApplicationServices";
import type { QuoteApplicationServices } from "@/modules/quotes/application/composition/quoteApplicationServices";
import type { ReturnApplicationServices } from "@/modules/returns/application/composition/returnApplicationServices";
import type { ShippingApplicationServices } from "@/modules/shipping/application/composition/shippingApplicationServices";
import type { SupportApplicationServices } from "@/modules/support/application/composition/supportApplicationServices";
import type { TaskApplicationServices } from "@/modules/tasks/application/composition/taskApplicationServices";
import type { ContactOpportunityCreationPorts } from "@/workflows/contact-opportunity-creation/application/ports/ContactOpportunityCreationPorts";
import type { CustomerConversionPort } from "@/workflows/customer-conversion/application/ports/CustomerConversionPort";
import type { DealRecyclePorts } from "@/workflows/deal-recycle/application/ports/DealRecyclePorts";
import type { LeadQualificationPorts } from "@/workflows/lead-qualification/application/ports/LeadQualificationPorts";
import type { OrderClosingPorts } from "@/workflows/order-closing/application/ports/OrderClosingPorts";
import type { PilotAcceptanceApplicationServices } from "@/workspaces/people-access/pilot-acceptance/application/composition/pilotAcceptanceApplicationServices";

export interface ApplicationModuleServiceBundle {
  commercialEvidence: CommercialEvidenceApplicationServices;
  contacts: ContactApplicationServices;
  customers: CustomerApplicationServices;
  deals: DealApplicationServices;
  invoices: InvoiceApplicationServices;
  leads: LeadApplicationServices;
  orders: OrderApplicationServices;
  organizations: OrganizationApplicationServices;
  payments: PaymentApplicationServices;
  products: ProductApplicationServices;
  quotes: QuoteApplicationServices;
  returns: ReturnApplicationServices;
  shipping: ShippingApplicationServices;
  support: SupportApplicationServices;
  tasks: TaskApplicationServices;
}

export interface ApplicationWorkflowServiceBundle {
  contactOpportunityCreation: ContactOpportunityCreationPorts;
  customerConversion: CustomerConversionPort;
  dealRecycle: DealRecyclePorts;
  leadQualification: LeadQualificationPorts;
  orderClosing: OrderClosingPorts;
}

export interface ApplicationWorkspaceServiceBundle {
  pilotAcceptance: PilotAcceptanceApplicationServices;
}

export interface ApplicationServiceBundle {
  modules: ApplicationModuleServiceBundle;
  workflows: ApplicationWorkflowServiceBundle;
  workspaces: ApplicationWorkspaceServiceBundle;
}

const REQUIRED_SERVICE_PATHS = [
  "modules.commercialEvidence",
  "modules.contacts",
  "modules.customers",
  "modules.deals",
  "modules.invoices",
  "modules.leads",
  "modules.orders",
  "modules.organizations",
  "modules.payments",
  "modules.products",
  "modules.quotes",
  "modules.returns",
  "modules.shipping",
  "modules.support",
  "modules.tasks",
  "workflows.contactOpportunityCreation",
  "workflows.customerConversion",
  "workflows.dealRecycle",
  "workflows.leadQualification",
  "workflows.orderClosing",
  "workspaces.pilotAcceptance",
] as const;

export function assertCompleteApplicationServiceBundle(
  services: ApplicationServiceBundle | undefined,
  runtimeLabel: string,
): asserts services is ApplicationServiceBundle {
  const missing = REQUIRED_SERVICE_PATHS.filter((servicePath) => !readPath(services, servicePath));
  if (missing.length === 0) return;
  throw new Error(
    `${runtimeLabel} requires explicit application services for every module and workflow. Missing: ${missing.join(", ")}. `
      + "Connected mode never falls back to browser repositories or demo workflow runtimes.",
  );
}

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}
