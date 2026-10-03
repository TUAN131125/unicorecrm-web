import { createApplicationServiceBinding } from "@/shared/application/applicationServiceBinding";
import { ApplicationError } from "@/shared/domain/applicationError";
import type { LeadCustomerConversionGateway, LeadCustomerConversionRequest, LeadConversionOutcome } from "../ports/LeadCustomerConversionGateway";

const binding = createApplicationServiceBinding<LeadCustomerConversionGateway>("Lead Customer Conversion");
export const configureLeadCustomerConversionGateway = binding.configure;
export const resetLeadCustomerConversionGateway = binding.reset;

export async function convertLeadToCustomer(leadId: string, expectedVersion: number, idempotencyKey: string, request: LeadCustomerConversionRequest): Promise<LeadConversionOutcome> {
  if (!binding.isConfigured()) throw new Error("Lead conversion requires the connected backend runtime.");
  return binding.get().convertLeadToCustomer(leadId, expectedVersion, idempotencyKey, request);
}

export function isLeadConversionInProgress(error: unknown): boolean {
  return error instanceof ApplicationError && error.code === "LEAD_CONVERSION_IN_PROGRESS";
}
