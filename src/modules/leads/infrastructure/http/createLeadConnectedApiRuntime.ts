import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import { ApplicationError } from "@/shared/domain";
import type { LeadApiRuntime, LeadCommandPort } from "../../application/ports/LeadApiRuntime";
import { LeadHttpApiAdapter } from "./LeadHttpApiAdapter";

export function createLeadConnectedApiRuntime(httpClient: HttpClient): LeadApiRuntime {
  const adapter = new LeadHttpApiAdapter(new CommercialApiClient(httpClient));
  const unavailable = async (operationId: string): Promise<never> => {
    throw new ApplicationError({
      code: "LEAD_CONNECTED_OPERATION_NOT_IMPLEMENTED",
      message: `${operationId} is not implemented by the current backend runtime.`,
      category: "INFRASTRUCTURE",
      retryable: false,
      userMessage: "This Lead action is not available in connected mode.",
      details: { module: "leads", operationId, authority: "backend-runtime" },
    });
  };
  const commands: LeadCommandPort = {
    createLead: (input, options) => adapter.createLead(input, options),
    replaceLeadProfile: (leadId, input, options) => adapter.replaceLeadProfile(leadId, input, options),
    advanceLeadWorkState: (leadId, input, options) => adapter.advanceLeadWorkState(leadId, input, options),
    disqualifyLead: (leadId, input, options) => adapter.disqualifyLead(leadId, input, options),
    reopenDisqualifiedLead: (leadId, options) => adapter.reopenDisqualifiedLead(leadId, options),
    archiveLead: () => unavailable("archiveLead"),
    assignLeadOwner: () => unavailable("assignLeadOwner"),
    importLeadBatch: () => unavailable("importLeadBatch"),
    handoverLeadWithTasks: () => unavailable("handoverLeadWithTasks"),
    archiveLeadBatch: () => unavailable("archiveLeadBatch"),
    advanceLeadWorkStateBatch: () => unavailable("advanceLeadWorkStateBatch"),
    assignLeadOwnerBatch: () => unavailable("assignLeadOwnerBatch"),
    disqualifyLeadBatch: () => unavailable("disqualifyLeadBatch"),
    applyLeadTagBatch: () => unavailable("applyLeadTagBatch"),
    scheduleLeadFollowUpBatch: () => unavailable("scheduleLeadFollowUpBatch"),
    claimLeadFromQueue: () => unavailable("claimLeadFromQueue"),
    requestLeadExport: () => unavailable("requestLeadExport"),
    anonymizeLead: () => unavailable("anonymizeLead"),
    recordLeadConsent: () => unavailable("recordLeadConsent"),
    mergeLeadDuplicates: () => unavailable("mergeLeadDuplicates"),
    confirmLeadDuplicatesDistinct: () => unavailable("confirmLeadDuplicatesDistinct"),
  };
  return {
    mode: "connected",
    queries: adapter,
    commands,
  };
}
