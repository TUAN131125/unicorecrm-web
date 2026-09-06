import type { CRMActivity } from "@/shared/domain";
import type { Lead } from "../../domain/model/lead.types";
import type { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";
import {
  advanceLeadWorkStateBatchViaApi,
  applyLeadTagBatchViaApi,
  advanceLeadWorkStateViaApi,
  archiveLeadViaApi,
  archiveLeadsViaApi,
  assignLeadOwnerBatchViaApi,
  assignLeadOwnerViaApi,
  claimLeadFromQueueViaApi,
  confirmLeadDuplicatesDistinctViaApi,
  disqualifyLeadBatchViaApi,
  disqualifyLeadViaApi,
  handoverLeadWithTasksViaApi,
  logLeadActivityViaApi,
  mergeLeadDuplicatesViaApi,
  recordLeadConsentViaApi,
  reopenDisqualifiedLeadViaApi,
  createLeadFromFormViaApi,
  replaceLeadProfileFromFormViaApi,
  replaceLeadViaTransformViaApi,
  scheduleLeadFollowUpBatchViaApi,
} from "../../public/leads";

export function useLeadActions() {
  return {
    createFromForm: (input: Partial<Lead>) => createLeadFromFormViaApi(input).then((result) => result.lead),
    replaceProfileFromForm: (leadId: string, input: Partial<Lead>) => replaceLeadProfileFromFormViaApi(leadId, input).then((result) => result.lead),
    update: (leadId: string, transform: (lead: Lead) => Lead) => replaceLeadViaTransformViaApi(leadId, transform).then((result) => result.lead),
    applyTagMany: (leadIds: readonly string[], tag: string) => applyLeadTagBatchViaApi(leadIds, tag).then((result) => result.leads),
    scheduleFollowUpMany: (leadIds: readonly string[], input: { followUpAt: string; note: string }) => scheduleLeadFollowUpBatchViaApi(leadIds, input).then((result) => result.leads),
    disqualifyMany: (leadIds: readonly string[], input: { reason: string; evidence?: string }) => disqualifyLeadBatchViaApi(leadIds, input).then((result) => result.leads),
    reassignMany: (leadIds: readonly string[], input: { ownerId: string; reason: string }) => assignLeadOwnerBatchViaApi(leadIds, input).then((result) => result.leads),
    claimFromQueue: (leadId: string, reason: string) => claimLeadFromQueueViaApi(leadId, reason).then((result) => result.lead),
    archive: (leadId: string, reason: string) => archiveLeadViaApi(leadId, reason).then((result) => result.lead),
    archiveMany: (leadIds: readonly string[], reason: string) => archiveLeadsViaApi(leadIds, reason).then((result) => result.leads),
    advanceNewToContacting: (leadIds: readonly string[]) => advanceLeadWorkStateBatchViaApi(leadIds, "CONTACTING"),
    advanceEligibleToVerifying: (leadIds: readonly string[]) => advanceLeadWorkStateBatchViaApi(leadIds, "VERIFYING"),
    changeWorkState: (leadId: string, leadWorkState: Exclude<LeadWorkState, "NEW" | "CLOSED">, _activity?: CRMActivity) =>
      advanceLeadWorkStateViaApi(leadId, { targetWorkState: leadWorkState }).then((result) => result.lead),
    startVerification: (leadId: string, input?: {
      companyName?: string;
      painPoint?: string;
      nextFollowUpAt?: string;
      activity?: CRMActivity;
    }) => advanceLeadWorkStateViaApi(leadId, {
      targetWorkState: "VERIFYING",
      ...(input === undefined ? {} : {
        verificationProfile: {
          companyName: input.companyName,
          painPoint: input.painPoint,
          nextFollowUpAt: input.nextFollowUpAt,
        },
      }),
    }).then((result) => result.lead),
    disqualify: (leadId: string, input: { reason: string; evidence?: string; actorId?: string; activity?: CRMActivity }) =>
      disqualifyLeadViaApi(leadId, { reason: input.reason, evidence: input.evidence }).then((result) => result.lead),
    reopen: (leadId: string, _activity?: CRMActivity) =>
      reopenDisqualifiedLeadViaApi(leadId).then((result) => result.lead),
    recordConsent: (leadId: string, input: {
      channel: "CALL" | "EMAIL" | "SMS" | "ZALO";
      decision: "GRANTED" | "DENIED" | "WITHDRAWN";
      source: string;
      evidence?: string;
      expiresAt?: string;
      lawfulBasis?: string;
      actorId?: string;
      actorName?: string;
    }) => recordLeadConsentViaApi(leadId, {
      channel: input.channel,
      decision: input.decision,
      source: input.source,
      ...(input.evidence === undefined ? {} : { evidence: input.evidence }),
      ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
      ...(input.lawfulBasis === undefined ? {} : { lawfulBasis: input.lawfulBasis }),
    }).then((result) => result.lead),
    mergeDuplicates: (input: { survivorLeadId: string; duplicateLeadIds: readonly string[]; reason: string; actorId?: string; actorName?: string }) =>
      mergeLeadDuplicatesViaApi({ survivorLeadId: input.survivorLeadId, duplicateLeadIds: input.duplicateLeadIds, reason: input.reason }).then((result) => result.leads),
    confirmDuplicatesDistinct: (input: { leadId: string; candidateLeadIds: readonly string[]; reason: string; actorId?: string }) =>
      confirmLeadDuplicatesDistinctViaApi({ leadId: input.leadId, candidateLeadIds: input.candidateLeadIds, reason: input.reason }).then((result) => result.leads),
    appendActivity: (leadId: string, activity: CRMActivity) => logLeadActivityViaApi(leadId, activity),
    handover: handoverLeadWithTasksViaApi,
    reassign: (leadId: string, input: {
      ownerId: string;
      reason: string;
      leadWorkState?: Exclude<LeadWorkState, "CLOSED">;
      activity?: CRMActivity;
    }) => assignLeadOwnerViaApi(leadId, { ownerId: input.ownerId, reason: input.reason }).then((result) => result.lead),
  };
}
