import { isTaskConnectedApiRuntime } from "../../application/composition/taskApplicationServices";

export type ActivityRecordingTime = "SERVER_NOW" | "CUSTOM_DATE";

export function openingActivityRecordingTime(recordingOnly: boolean, requested?: ActivityRecordingTime): ActivityRecordingTime {
  return recordingOnly && isTaskConnectedApiRuntime() && requested !== "CUSTOM_DATE" ? "SERVER_NOW" : "CUSTOM_DATE";
}

/** The UI submits an explicit record-now intent with no date, never a discarded date. */
export function resolveActivityRecordingDate(draft: { recordingTime?: ActivityRecordingTime; occurredAt: string }): string | undefined {
  if (draft.recordingTime === "SERVER_NOW") {
    if (draft.occurredAt !== "") throw new Error("ACTIVITY_RECORDING_TIME_INTENT_CONFLICT");
    return undefined;
  }
  const date = new Date(draft.occurredAt);
  if (Number.isNaN(date.getTime())) throw new Error("ACTIVITY_DATE_INVALID");
  if (isTaskConnectedApiRuntime()) throw new Error("ACTIVITY_RECORDING_DATE_UNAVAILABLE");
  return date.toISOString();
}

export function isCustomActivityDateUnavailable(recordingTime?: ActivityRecordingTime): boolean {
  return recordingTime !== "SERVER_NOW" && isTaskConnectedApiRuntime();
}
