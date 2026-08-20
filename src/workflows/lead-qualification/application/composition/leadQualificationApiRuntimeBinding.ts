import { createApplicationServiceBinding } from "@/shared/application";
import type { LeadQualificationApiRuntime } from "../ports/LeadQualificationApiRuntime";

const binding = createApplicationServiceBinding<LeadQualificationApiRuntime>("Lead Qualification API runtime");

export const configureLeadQualificationApiRuntime = binding.configure;
export const getLeadQualificationApiRuntime = binding.get;
export const resetLeadQualificationApiRuntime = binding.reset;
