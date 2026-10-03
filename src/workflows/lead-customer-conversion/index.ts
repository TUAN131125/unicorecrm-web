export {
  editableLeadCustomerConversionFields,
  isLeadCustomerConversionSuppressed,
  retainOrCreateConversionIntent,
} from "./application/conversionIntent";

export type { LeadCustomerConversionIntent } from "./application/conversionIntent";

export { convertLeadToCustomer, isLeadConversionInProgress } from "./application/composition/leadCustomerConversionApplicationServices";
export type { LeadCustomerConversionGateway, LeadCustomerConversionRequest, LeadConversionOutcome } from "./application/ports/LeadCustomerConversionGateway";
