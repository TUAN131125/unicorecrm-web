import type { Task } from "@/modules/tasks";
import type { Deal } from "@/modules/deals";
import type { Lead } from "@/modules/leads";
import type { CustomerOrder } from "@/modules/orders";
import type { Quote } from "@/modules/quotes";
import type { QualificationOutcome } from "@/modules/leads";
import type { CRMActivity } from "@/shared/domain";

import type { ResolvedLeadRelationship, LeadRelationshipInput } from "../../domain/leadQualification.types";

export interface LeadQualificationPorts {
  leads: {
    getById(leadId: string): Lead | undefined;
    close(leadId: string, input: {
      outcome: QualificationOutcome;
      relationshipRef: ResolvedLeadRelationship["relationshipRef"];
      dealRef?: string;
      activity?: CRMActivity;
    }): Lead | undefined;
  };
  relationships: {
    resolve(lead: Lead, input: LeadRelationshipInput, context: { nowIso: string; seed: string }): ResolvedLeadRelationship;
  };
  tasks: { create(input: {
    id: string;
    title: string;
    description?: string;
    assigneeId: string;
    dueAt: string;
    relationshipRef: ResolvedLeadRelationship["relationshipRef"];
    recordRef: { moduleKey: string; recordId: string; label?: string };
    sourceRef: { type: string; id: string; evidence?: string };
    dedupeKey: string;
    actorId: string;
    now: string;
  }): Task };
  deals: { create(deal: Deal): Deal };
  quotes: { create(quote: Quote): Quote };
  orders: { create(order: CustomerOrder, relationshipKey: string): CustomerOrder };
}
