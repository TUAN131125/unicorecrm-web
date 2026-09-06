import { isBusinessOperationUnavailable } from "@/shared/application";

export const LEAD_POSITIVE_QUALIFICATION_OPERATION = "Lead positive qualification";
export const LEAD_DIRECT_SALE_QUALIFICATION_OPERATION = "Lead Direct Sale qualification";
export const LEAD_ORGANIZATION_QUALIFICATION_OPERATION = "Lead Organization Account qualification";

export function isLeadPositiveQualificationUnavailable(): boolean {
  return isBusinessOperationUnavailable(LEAD_POSITIVE_QUALIFICATION_OPERATION);
}

export function isLeadDirectSaleQualificationUnavailable(): boolean {
  return isBusinessOperationUnavailable(LEAD_DIRECT_SALE_QUALIFICATION_OPERATION);
}

export function isLeadOrganizationQualificationUnavailable(): boolean {
  return isBusinessOperationUnavailable(LEAD_ORGANIZATION_QUALIFICATION_OPERATION);
}
