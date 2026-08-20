import { createApplicationServiceBinding } from "@/shared/application";
import type { LeadQualificationPorts } from "../ports/LeadQualificationPorts";

const binding = createApplicationServiceBinding<LeadQualificationPorts>("Lead Qualification workflow");
export const configureLeadQualificationApplication = binding.configure;
export const getLeadQualificationApplicationServices = binding.get;
export const resetLeadQualificationApplication = binding.reset;

export const createLeadQualificationRuntime = () => binding.get();
