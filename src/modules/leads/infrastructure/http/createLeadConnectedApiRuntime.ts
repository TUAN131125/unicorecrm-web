import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import { ApplicationError } from "@/shared/domain";
import { declareUnavailableBusinessOperation } from "@/shared/application";
import type { LeadApiRuntime, LeadCommandPort } from "../../application/ports/LeadApiRuntime";
import { LEAD_OPERATION } from "../../application/leadOperationAvailability";
import { LeadHttpApiAdapter } from "./LeadHttpApiAdapter";

export function createLeadConnectedApiRuntime(httpClient: HttpClient): LeadApiRuntime {
  const adapter = new LeadHttpApiAdapter(new CommercialApiClient(httpClient));
  const unavailable = (operationId: string) => {
    declareUnavailableBusinessOperation(operationId);
    return async (): Promise<never> => {
      throw new ApplicationError({
        code: "LEAD_CONNECTED_OPERATION_NOT_IMPLEMENTED",
        message: `${operationId} is not implemented by the current backend runtime.`,
        category: "INFRASTRUCTURE",
        retryable: false,
        userMessage: "This Lead action is not available in connected mode.",
        details: { module: "leads", operationId, authority: "backend-runtime" },
      });
    };
  };
  const commands: LeadCommandPort = {
    createLead: (input, options) => adapter.createLead(input, options),
    replaceLeadProfile: (leadId, input, options) => adapter.replaceLeadProfile(leadId, input, options),
    advanceLeadWorkState: (leadId, input, options) => adapter.advanceLeadWorkState(leadId, input, options),
    disqualifyLead: (leadId, input, options) => adapter.disqualifyLead(leadId, input, options),
    reopenDisqualifiedLead: (leadId, options) => adapter.reopenDisqualifiedLead(leadId, options),
    archiveLead: (leadId, input, options) => adapter.archiveLead(leadId, input, options),
    assignLeadOwner: unavailable(LEAD_OPERATION.ASSIGN_OWNER),
    importLeadBatch: unavailable(LEAD_OPERATION.IMPORT_BATCH),
    handoverLeadWithTasks: unavailable(LEAD_OPERATION.HANDOVER_WITH_TASKS),
    archiveLeadBatch: (input, options) => adapter.archiveLeadBatch(input, options),
    advanceLeadWorkStateBatch: unavailable(LEAD_OPERATION.ADVANCE_WORK_STATE_BATCH),
    assignLeadOwnerBatch: unavailable(LEAD_OPERATION.ASSIGN_OWNER_BATCH),
    disqualifyLeadBatch: unavailable(LEAD_OPERATION.DISQUALIFY_BATCH),
    applyLeadTagBatch: unavailable(LEAD_OPERATION.APPLY_TAG_BATCH),
    scheduleLeadFollowUpBatch: unavailable(LEAD_OPERATION.SCHEDULE_FOLLOW_UP_BATCH),
    claimLeadFromQueue: unavailable("claimLeadFromQueue"),
    requestLeadExport: unavailable(LEAD_OPERATION.REQUEST_EXPORT),
    anonymizeLead: unavailable("anonymizeLead"),
    recordLeadConsent: unavailable("recordLeadConsent"),
    mergeLeadDuplicates: unavailable("mergeLeadDuplicates"),
    confirmLeadDuplicatesDistinct: unavailable("confirmLeadDuplicatesDistinct"),
  };
  return {
    mode: "connected",
    queries: adapter,
    commands,
  };
}
