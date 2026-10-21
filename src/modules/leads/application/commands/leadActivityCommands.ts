import { resolveEffectiveAccess } from "@/platform/access-control";
import { runBackendProjection } from "@/shared/application";
import { ApplicationError, type CRMActivity } from "@/shared/domain";
import { isManualActivityType, logActivityViaApi, type ManualActivityType } from "@/modules/tasks";
import { leadRepository } from "../composition/leadApplicationServices";
import { saveLead } from "./leadRepositoryCommands";

export async function logLeadActivityViaApi(leadId: string, input: CRMActivity): Promise<CRMActivity> {
  const access = resolveEffectiveAccess();
  if (!access.memberId) throw new Error("LEAD_ACTIVITY_ACTOR_REQUIRED");
  const outcome = await logActivityViaApi({
    id: input.id,
    type: normalizeActivityType(input.type),
    subject: input.title,
    ...(input.description === undefined ? {} : { body: input.description }),
    actorId: access.memberId,
    ...(input.author === undefined ? {} : { actorName: input.author }),
    recordRef: { moduleKey: "leads", recordId: leadId },
  });
  const activity = outcome.data.activity;
  const projected: CRMActivity = {
    id: activity.id,
    title: activity.subject,
    ...(activity.body === undefined ? {} : { description: activity.body }),
    createdAt: activity.occurredAt,
    author: input.author,
    type: activity.type.toLocaleLowerCase(),
  };
  const current = leadRepository.getById(leadId);
  if (current) {
    runBackendProjection("leads", () => saveLead(leadRepository, {
      ...current,
      activities: [projected, ...(current.activities ?? []).filter((item) => item.id !== projected.id)],
      activitiesAuthority: "NOT_INCLUDED",
    }));
  }
  return projected;
}

function normalizeActivityType(value: string): ManualActivityType {
  const normalized = value.trim().toUpperCase();
  if (isManualActivityType(normalized)) return normalized;
  throw new ApplicationError({ code: "VALIDATION_FAILED", category: "VALIDATION", message: "Unsupported manual Lead Activity type.", retryable: false });
}
