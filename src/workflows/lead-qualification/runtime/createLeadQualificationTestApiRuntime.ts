import type {
  LeadQualificationApiRuntime,
  LeadQualificationCommandPort,
} from "../application/ports/LeadQualificationApiRuntime";

export function createLeadQualificationTestApiRuntime(
  commands: LeadQualificationCommandPort,
): LeadQualificationApiRuntime {
  return { mode: "test", commands };
}
