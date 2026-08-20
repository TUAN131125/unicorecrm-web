import { createApplicationServiceBinding } from "@/shared/application";
import type { ContactOpportunityCreationPorts } from "../ports/ContactOpportunityCreationPorts";

const binding = createApplicationServiceBinding<ContactOpportunityCreationPorts>("Contact Opportunity Creation workflow");
export const configureContactOpportunityApplication = binding.configure;
export const createContactOpportunityCreationRuntime = () => binding.get();
