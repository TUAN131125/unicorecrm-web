import { getApplicationHttpClient } from "@/app/composition/applicationComposition";
import {
  CommercialApiClient,
  type ConvertLeadToCustomerRequest,
  type LeadCustomerConversionResponse,
} from "@/platform/api/generated/commercialApi";

export async function convertLeadToCustomer(
  leadId: string,
  expectedVersion: number,
  request: ConvertLeadToCustomerRequest,
): Promise<LeadCustomerConversionResponse> {
  const http = getApplicationHttpClient();
  if (!http) throw new Error("Lead conversion requires the connected backend runtime.");
  return new CommercialApiClient(http).convertLeadToCustomer(leadId, request, {
    expectedVersion,
    idempotencyKey: crypto.randomUUID(),
    retry: "idempotent",
  });
}
