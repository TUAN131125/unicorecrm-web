import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import { ApplicationError } from "@/shared/domain";
import type { LeadQualificationApiRuntime } from "../../application/ports/LeadQualificationApiRuntime";
import { LeadQualificationHttpAdapter } from "./LeadQualificationHttpAdapter";

export function createLeadQualificationConnectedApiRuntime(httpClient: HttpClient): LeadQualificationApiRuntime {
  const adapter = new LeadQualificationHttpAdapter(new CommercialApiClient(httpClient));
  const unavailable = async (): Promise<never> => {
    throw new ApplicationError({
      code: "LEAD_DIRECT_SALE_UNAVAILABLE",
      message: "Direct Sale Lead qualification is not admitted by the current backend runtime.",
      category: "BUSINESS_RULE",
      retryable: false,
      userMessage: "Direct Sale is not currently available in connected mode.",
      details: { workflow: "lead-qualification", operation: "DIRECT_SALE", authority: "backend-runtime" },
    });
  };
  return {
    mode: "connected",
    commands: {
      qualifyForNurture: (command, options) => adapter.qualifyForNurture(command, options),
      qualifyForOpportunity: (command, options) => adapter.qualifyForOpportunity(command, options),
      qualifyForDirectSale: unavailable,
    },
  };
}
