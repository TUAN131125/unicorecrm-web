export {
  executeContactOpportunityCreation,
  type CreateContactOpportunityCommand,
  type CreateContactOpportunityResult,
} from "./application/executeContactOpportunityCreation";
export { createContactOpportunityCreationRuntime } from "./application/composition/contactOpportunityApplicationServices";
export {
  CONTACT_OPPORTUNITY_CREATION_OPERATION,
  isContactOpportunityCreationUnavailable,
} from "./application/contactOpportunityAvailability";
