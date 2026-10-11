import { ApplicationError } from "@/shared/domain";
import { isBusinessOperationUnavailable } from "@/shared/application";
import { getLeadApiRuntime } from "../composition/leadApplicationServices";
import type { Lead } from "../../domain/model/lead.types";
import type { ReplaceLeadProfileResult } from "../ports/LeadApiRuntime";
import { profileViolation, projectAndInvalidate, toLeadProfileInput } from "./leadApiCommands";

/** Tags replace the opening profile with its observed version, never a latest-read rebase. */
export async function replaceLeadTagsViaApi(
  opening: Lead,
  tags: readonly string[],
  attempt: { idempotencyKey: string; isCurrent: () => boolean },
): Promise<ReplaceLeadProfileResult | undefined> {
  if (!Array.isArray(opening.tags)) {
    throw new ApplicationError({ code: "LEAD_TAGS_OPENING_REQUIRED", category: "AUTHORIZATION", retryable: false,
      message: "Tag changes require an authoritative opening tag collection." });
  }
  const version = opening.resourceVersion;
  if (!Number.isSafeInteger(version) || version === undefined || version < 0) {
    throw new ApplicationError({ code: "LEAD_PROFILE_VERSION_REQUIRED", category: "CONFLICT", retryable: false,
      message: "Tag changes require the opening Lead version." });
  }
  if (!attempt.isCurrent() || isBusinessOperationUnavailable("replaceLeadProfile")) return;
  const profile = toLeadProfileInput({ ...opening, tags: [...tags] }, true);
  const result = await getLeadApiRuntime().commands.replaceLeadProfile(opening.id, profile, {
    idempotencyKey: attempt.idempotencyKey, expectedVersion: version,
  });
  if (!attempt.isCurrent()) return;
  if (result.lead.id !== opening.id || result.evidence.aggregateId !== opening.id || !Number.isSafeInteger(result.lead.resourceVersion)
    || result.lead.resourceVersion !== Number(result.evidence.version)
    || (result.lead.resourceVersion ?? -1) <= version
    || !["COMMITTED", "REPLAYED"].includes(result.evidence.outcome)
    || !result.evidence.commandId || !result.evidence.correlationId || !result.evidence.aggregateType
    || !Number.isFinite(Date.parse(result.evidence.occurredAt))
    || !Array.isArray(result.lead.tags) || result.lead.tags.length !== tags.length
    || tags.some(tag => !result.lead.tags?.includes(tag))) {
    throw profileViolation("tags", "Tag replacement requires a matching authoritative Lead and receipt.");
  }
  await projectAndInvalidate(result, "lead.update");
  return attempt.isCurrent() ? result : undefined;
}
