import { LeadWorkState, QualificationOutcome } from "@/modules/leads";
import type { ExecuteLeadNurtureCommand, LeadQualificationResult } from "../domain/leadQualification.types";
import type { LeadQualificationPorts } from "./ports/LeadQualificationPorts";
import { assertValidRelationshipInput } from "../domain/leadQualification.rules";

export function executeLeadNurture(
  command: ExecuteLeadNurtureCommand,
  ports: LeadQualificationPorts,
): LeadQualificationResult {
  const lead = ports.leads.getById(command.leadId);
  if (!lead) throw new Error(`Lead not found: ${command.leadId}`);
  if (lead.leadWorkState !== LeadWorkState.VERIFYING) throw new Error("Lead must be VERIFYING before qualification can be closed.");
  if (!command.reason.trim()) throw new Error("NURTURE requires a reason.");
  if (!command.revisitAt.trim()) throw new Error("NURTURE requires revisitAt.");
  assertValidRelationshipInput(command.relationship);

  const now = command.now ?? new Date();
  const nowIso = now.toISOString();
  const seed = command.idSeed ?? String(now.getTime());
  const relationship = ports.relationships.resolve(lead, command.relationship, { nowIso, seed });
  const task = ports.tasks.create({
    id: `task_lead_nurture_${seed}`,
    title: `Theo dõi nurture: ${relationship.displayName}`,
    description: [command.reason.trim(), command.note?.trim()].filter(Boolean).join(" — "),
    assigneeId: command.ownerId || lead.ownerId || "unassigned",
    dueAt: command.revisitAt,
    relationshipRef: relationship.relationshipRef,
    recordRef: { moduleKey: "leads", recordId: lead.id, label: lead.name },
    sourceRef: { type: "LEAD_NURTURE", id: lead.id, evidence: "Lead qualification outcome NURTURE" },
    dedupeKey: `lead-nurture:${lead.id}:${command.revisitAt}`,
    actorId: command.ownerId || lead.ownerId || "qualification-workflow",
    now: nowIso,
  });

  ports.leads.close(lead.id, {
    outcome: QualificationOutcome.NURTURE,
    relationshipRef: relationship.relationshipRef,
    activity: {
      id: `act_nurture_${seed}`,
      type: "system",
      title: "Lead closed: Nurture",
      description: `Relationship resolved to ${relationship.displayName}. Revisit at ${command.revisitAt}. Reason: ${command.reason.trim()}`,
      createdAt: nowIso,
      author: "Qualification Workflow",
    },
  });

  return {
    leadId: lead.id,
    relationshipRef: relationship.relationshipRef,
    contactId: relationship.contactId,
    organizationAccountId: relationship.organizationAccountId,
    taskId: task.id,
  };
}
