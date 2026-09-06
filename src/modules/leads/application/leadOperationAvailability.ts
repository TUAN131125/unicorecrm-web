import { isBusinessOperationUnavailable } from "@/shared/application";

export const LEAD_OPERATION = {
  ARCHIVE: "archiveLead",
  ASSIGN_OWNER: "assignLeadOwner",
  IMPORT_BATCH: "importLeadBatch",
  HANDOVER_WITH_TASKS: "handoverLeadWithTasks",
  ARCHIVE_BATCH: "archiveLeadBatch",
  ADVANCE_WORK_STATE_BATCH: "advanceLeadWorkStateBatch",
  ASSIGN_OWNER_BATCH: "assignLeadOwnerBatch",
  DISQUALIFY_BATCH: "disqualifyLeadBatch",
  APPLY_TAG_BATCH: "applyLeadTagBatch",
  SCHEDULE_FOLLOW_UP_BATCH: "scheduleLeadFollowUpBatch",
  REQUEST_EXPORT: "requestLeadExport",
} as const;

export type LeadOperation = (typeof LEAD_OPERATION)[keyof typeof LEAD_OPERATION];

export function isLeadOperationAvailable(operation: LeadOperation): boolean {
  return !isBusinessOperationUnavailable(operation);
}
