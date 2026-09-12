import { getApplicationHttpClient } from "@/app/composition/applicationComposition";
import {
  CommercialApiClient,
  type ConvertLeadToCustomerRequest,
  type LeadCustomerConversionResponse,
} from "@/platform/api/generated/commercialApi";
import { ApiClientError } from "@/platform/api/errors";

export type LeadConversionOutcome = LeadCustomerConversionResponse;
export function isLeadConversionInProgress(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "LEAD_CONVERSION_IN_PROGRESS";
}

export async function convertLeadToCustomer(
  leadId: string,
  expectedVersion: number,
  idempotencyKey: string,
  request: ConvertLeadToCustomerRequest,
): Promise<LeadCustomerConversionResponse> {
  const http = getApplicationHttpClient();
  if (!http) throw new Error("Lead conversion requires the connected backend runtime.");
  return new CommercialApiClient(http).convertLeadToCustomer(leadId, request, {
    expectedVersion,
    idempotencyKey,
    retry: "idempotent",
  });
}
