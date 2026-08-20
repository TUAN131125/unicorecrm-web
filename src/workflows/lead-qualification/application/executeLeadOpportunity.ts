import { DealStage } from "@/modules/deals";
import { LeadWorkState, QualificationOutcome } from "@/modules/leads";
import { assertValidOpportunityCommand } from "../domain/leadQualification.rules";
import type { ExecuteLeadOpportunityCommand, LeadQualificationResult } from "../domain/leadQualification.types";
import type { LeadQualificationPorts } from "./ports/LeadQualificationPorts";

export function executeLeadOpportunity(
  command: ExecuteLeadOpportunityCommand,
  ports: LeadQualificationPorts,
): LeadQualificationResult {
  const lead = ports.leads.getById(command.leadId);
  if (!lead) throw new Error(`Lead not found: ${command.leadId}`);
  if (lead.leadWorkState !== LeadWorkState.VERIFYING) throw new Error("Lead must be VERIFYING before qualification can be closed.");
  assertValidOpportunityCommand(command);

  const now = command.now ?? new Date();
  const nowIso = now.toISOString();
  const seed = command.idSeed ?? String(now.getTime());
  const relationship = ports.relationships.resolve(lead, command.relationship, { nowIso, seed });
  const dealId = `deal_${seed}`;
  const followUpTask = command.deal.followUpTask;
  const followUpDueAt = followUpTask ? new Date(followUpTask.dueAt).toISOString() : undefined;
  const taskId = followUpDueAt ? `task_deal_${dealId}_${followUpDueAt.slice(0, 10)}` : undefined;

  if (followUpTask && followUpDueAt && taskId) {
    ports.tasks.create({
      id: taskId,
      title: followUpTask.title,
      description: followUpTask.description || command.deal.needSummary,
      assigneeId: command.deal.ownerId,
      dueAt: followUpDueAt,
      relationshipRef: relationship.relationshipRef,
      recordRef: { moduleKey: "deals", recordId: dealId, label: command.deal.name.trim() },
      sourceRef: { type: "DEAL_NEXT_ACTION", id: dealId, evidence: "Created from lead qualification" },
      dedupeKey: `deal-next-action:${dealId}:${followUpDueAt}`,
      actorId: command.deal.ownerId,
      now: nowIso,
    });
  }

  ports.deals.create({
    id: dealId,
    name: command.deal.name.trim(),
    stage: DealStage.DISCOVERY,
    amount: command.deal.estimatedValue ?? 0,
    opportunityScore: 40,
    ownerId: command.deal.ownerId,
    expectedCloseDate: command.deal.expectedCloseDate?.trim() || "",
    createdAt: nowIso,
    updatedAt: nowIso,
    interestedProducts: [...new Set(command.deal.interestedProductIds)],
    lineItems: [],
    contactId: relationship.contactId,
    contactName: relationship.contactName,
    contactEmail: relationship.contactEmail,
    contactPhone: relationship.contactPhone,
    contactTitle: relationship.contactTitle,
    organizationAccountId: relationship.organizationAccountId,
    organizationAccountName: relationship.organizationName,
    customerName: relationship.organizationName || relationship.contactName || relationship.displayName,
    address: relationship.organizationAddress || relationship.contactAddress,
    buyerRef: relationship.relationshipRef,
    leadId: lead.id,
    leadName: lead.name,
    description: command.deal.needSummary?.trim() || undefined,
    nextActionAt: followUpDueAt,
    nextActionSummary: followUpTask?.title.trim(),
    nextActionRef: taskId ? { type: "TASK", id: taskId } : undefined,
  });

  ports.leads.close(lead.id, {
    outcome: QualificationOutcome.OPPORTUNITY,
    relationshipRef: relationship.relationshipRef,
    dealRef: dealId,
    activity: {
      id: `act_opportunity_${seed}`,
      type: "system",
      title: "Lead closed: Opportunity",
      description: `Deal ${dealId} created for ${relationship.displayName}.`,
      createdAt: nowIso,
      author: "Qualification Workflow",
    },
  });

  return {
    leadId: lead.id,
    relationshipRef: relationship.relationshipRef,
    contactId: relationship.contactId,
    organizationAccountId: relationship.organizationAccountId,
    taskId,
    dealId,
  };
}
