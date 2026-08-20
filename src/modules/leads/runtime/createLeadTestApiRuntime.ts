import type { LeadApiRuntime, LeadCommandPort, LeadQueryPort } from "../application/ports/LeadApiRuntime";

export function createLeadTestApiRuntime(input: {
  queries: LeadQueryPort;
  commands: LeadCommandPort;
}): LeadApiRuntime {
  return {
    mode: "test",
    queries: input.queries,
    commands: input.commands,
  };
}
