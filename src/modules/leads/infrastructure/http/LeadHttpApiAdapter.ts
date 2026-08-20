import type { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type {
  AdvanceLeadWorkStateBatchInput,
  AdvanceLeadWorkStateBatchResult,
  AdvanceLeadWorkStateInput,
  AdvanceLeadWorkStateResult,
  AnonymizeLeadResult,
  ApplyLeadTagBatchInput,
  ApplyLeadTagBatchResult,
  ArchiveLeadBatchInput,
  ArchiveLeadBatchResult,
  ArchiveLeadInput,
  ArchiveLeadResult,
  AssignLeadOwnerBatchInput,
  AssignLeadOwnerBatchResult,
  AssignLeadOwnerInput,
  AssignLeadOwnerResult,
  ClaimLeadFromQueueInput,
  ClaimLeadFromQueueResult,
  ConfirmLeadDuplicatesDistinctInput,
  ConfirmLeadDuplicatesDistinctResult,
  CreateLeadInput,
  CreateLeadResult,
  DisqualifyLeadBatchInput,
  DisqualifyLeadBatchResult,
  DisqualifyLeadInput,
  DisqualifyLeadResult,
  HandoverLeadWithTasksInput,
  HandoverLeadWithTasksResult,
  ImportLeadBatchInput,
  ImportLeadBatchResult,
  LeadCommandOptions,
  LeadCommandPort,
  LeadListQuery,
  LeadQueryPort,
  LeadVersionedCommandOptions,
  MergeLeadDuplicatesInput,
  MergeLeadDuplicatesResult,
  RecordLeadConsentInput,
  RecordLeadConsentResult,
  RequestLeadExportInput,
  RequestLeadExportResult,
  ReopenDisqualifiedLeadResult,
  ScheduleLeadFollowUpBatchInput,
  ScheduleLeadFollowUpBatchResult,
  ReplaceLeadProfileInput,
  ReplaceLeadProfileOptions,
  ReplaceLeadProfileResult,
} from "../../application/ports/LeadApiRuntime";
import type { AuthoritativePage } from "@/shared/application";
import type { Lead } from "../../domain/model/lead.types";
import { LeadHttpCommandAdapter } from "./LeadHttpCommandAdapter";
import { LeadHttpQueryAdapter } from "./LeadHttpQueryAdapter";

/**
 * Canonical production API boundary for the Lead module.
 * Generated DTOs and transport concerns stop here; callers depend only on
 * Lead application ports and application-owned models.
 */
export class LeadHttpApiAdapter implements LeadQueryPort, LeadCommandPort {
  private readonly queries: LeadHttpQueryAdapter;
  private readonly commands: LeadHttpCommandAdapter;

  constructor(api: CommercialApiClient) {
    this.queries = new LeadHttpQueryAdapter(api);
    this.commands = new LeadHttpCommandAdapter(api);
  }

  list(query?: LeadListQuery, signal?: AbortSignal): Promise<AuthoritativePage<Lead>> {
    return this.queries.list(query, signal);
  }

  get(leadId: string, signal?: AbortSignal): Promise<Lead> {
    return this.queries.get(leadId, signal);
  }

  createLead(input: CreateLeadInput, options: LeadCommandOptions): Promise<CreateLeadResult> {
    return this.commands.createLead(input, options);
  }

  replaceLeadProfile(leadId: string, input: ReplaceLeadProfileInput, options: ReplaceLeadProfileOptions): Promise<ReplaceLeadProfileResult> {
    return this.commands.replaceLeadProfile(leadId, input, options);
  }

  advanceLeadWorkState(leadId: string, input: AdvanceLeadWorkStateInput, options: LeadVersionedCommandOptions): Promise<AdvanceLeadWorkStateResult> {
    return this.commands.advanceLeadWorkState(leadId, input, options);
  }

  disqualifyLead(leadId: string, input: DisqualifyLeadInput, options: LeadVersionedCommandOptions): Promise<DisqualifyLeadResult> {
    return this.commands.disqualifyLead(leadId, input, options);
  }

  reopenDisqualifiedLead(leadId: string, options: LeadVersionedCommandOptions): Promise<ReopenDisqualifiedLeadResult> {
    return this.commands.reopenDisqualifiedLead(leadId, options);
  }
  archiveLead(leadId: string, input: ArchiveLeadInput, options: LeadVersionedCommandOptions): Promise<ArchiveLeadResult> {
    return this.commands.archiveLead(leadId, input, options);
  }

  assignLeadOwner(leadId: string, input: AssignLeadOwnerInput, options: LeadVersionedCommandOptions): Promise<AssignLeadOwnerResult> {
    return this.commands.assignLeadOwner(leadId, input, options);
  }

  importLeadBatch(input: ImportLeadBatchInput, options: LeadCommandOptions): Promise<ImportLeadBatchResult> {
    return this.commands.importLeadBatch(input, options);
  }

  handoverLeadWithTasks(leadId: string, input: HandoverLeadWithTasksInput, options: LeadVersionedCommandOptions): Promise<HandoverLeadWithTasksResult> {
    return this.commands.handoverLeadWithTasks(leadId, input, options);
  }

  archiveLeadBatch(input: ArchiveLeadBatchInput, options: LeadCommandOptions): Promise<ArchiveLeadBatchResult> {
    return this.commands.archiveLeadBatch(input, options);
  }

  advanceLeadWorkStateBatch(input: AdvanceLeadWorkStateBatchInput, options: LeadCommandOptions): Promise<AdvanceLeadWorkStateBatchResult> {
    return this.commands.advanceLeadWorkStateBatch(input, options);
  }

  assignLeadOwnerBatch(input: AssignLeadOwnerBatchInput, options: LeadCommandOptions): Promise<AssignLeadOwnerBatchResult> {
    return this.commands.assignLeadOwnerBatch(input, options);
  }

  disqualifyLeadBatch(input: DisqualifyLeadBatchInput, options: LeadCommandOptions): Promise<DisqualifyLeadBatchResult> {
    return this.commands.disqualifyLeadBatch(input, options);
  }

  applyLeadTagBatch(input: ApplyLeadTagBatchInput, options: LeadCommandOptions): Promise<ApplyLeadTagBatchResult> {
    return this.commands.applyLeadTagBatch(input, options);
  }

  scheduleLeadFollowUpBatch(input: ScheduleLeadFollowUpBatchInput, options: LeadCommandOptions): Promise<ScheduleLeadFollowUpBatchResult> {
    return this.commands.scheduleLeadFollowUpBatch(input, options);
  }

  claimLeadFromQueue(leadId: string, input: ClaimLeadFromQueueInput, options: LeadVersionedCommandOptions): Promise<ClaimLeadFromQueueResult> {
    return this.commands.claimLeadFromQueue(leadId, input, options);
  }

  requestLeadExport(input: RequestLeadExportInput, options: LeadCommandOptions): Promise<RequestLeadExportResult> {
    return this.commands.requestLeadExport(input, options);
  }

  anonymizeLead(leadId: string, input: ArchiveLeadInput, options: LeadVersionedCommandOptions): Promise<AnonymizeLeadResult> {
    return this.commands.anonymizeLead(leadId, input, options);
  }

  recordLeadConsent(leadId: string, input: RecordLeadConsentInput, options: LeadVersionedCommandOptions): Promise<RecordLeadConsentResult> {
    return this.commands.recordLeadConsent(leadId, input, options);
  }

  mergeLeadDuplicates(input: MergeLeadDuplicatesInput, options: LeadCommandOptions): Promise<MergeLeadDuplicatesResult> {
    return this.commands.mergeLeadDuplicates(input, options);
  }

  confirmLeadDuplicatesDistinct(input: ConfirmLeadDuplicatesDistinctInput, options: LeadCommandOptions): Promise<ConfirmLeadDuplicatesDistinctResult> {
    return this.commands.confirmLeadDuplicatesDistinct(input, options);
  }
}

