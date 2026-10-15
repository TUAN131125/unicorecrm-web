import { createMutationMetadata, type MutationCommandMetadata } from "@/shared/application";
import type { ExecuteLeadOpportunityCommand } from "../../domain/leadQualification.types";

export interface LeadOpportunityIntent {
  readonly command: ExecuteLeadOpportunityCommand;
  readonly metadata: MutationCommandMetadata;
  readonly authority: string;
  readonly generation: number;
}

/** One form intent; recovery always resends the captured body, key and original Lead version. */
export function createLeadOpportunityIntent(command: ExecuteLeadOpportunityCommand, expectedVersion: number, authority: string, generation: number): LeadOpportunityIntent {
  const copy = structuredClone(command);
  Object.freeze(copy.relationship.contact);
  if (copy.relationship.organization) Object.freeze(copy.relationship.organization);
  Object.freeze(copy.relationship);
  Object.freeze(copy.deal.interestedProductIds);
  if (copy.deal.followUpTask) Object.freeze(copy.deal.followUpTask);
  Object.freeze(copy.deal);
  Object.freeze(copy);
  return Object.freeze({ command: copy, metadata: Object.freeze(createMutationMetadata(`lead.qualify-opportunity:${command.leadId}`, { expectedVersion })), authority, generation });
}
