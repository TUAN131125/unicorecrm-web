import { isBusinessOperationUnavailable } from "@/shared/application";

export const LEAD_POSITIVE_QUALIFICATION_OPERATION = "Lead positive qualification";

export function isLeadPositiveQualificationUnavailable(): boolean {
  return isBusinessOperationUnavailable(LEAD_POSITIVE_QUALIFICATION_OPERATION);
}
