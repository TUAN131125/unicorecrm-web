import type { HttpClient } from "@/platform/api/client";
import { ApplicationError } from "@/shared/domain";
import type { LeadQualificationApiRuntime } from "../../application/ports/LeadQualificationApiRuntime";

export function createLeadQualificationConnectedApiRuntime(_httpClient: HttpClient): LeadQualificationApiRuntime {
  const unavailable = async (): Promise<never> => {
    throw new ApplicationError({
      code: "LEAD_QUALIFICATION_BACKEND_NOT_IMPLEMENTED",
      message: "Positive Lead qualification workflows are not implemented by the current backend runtime.",
      category: "INFRASTRUCTURE",
      retryable: false,
      userMessage: "Lead qualification is not available in connected mode yet.",
      details: { workflow: "lead-qualification", authority: "backend-runtime" },
    });
  };
  return {
    mode: "connected",
    commands: {
      qualifyForNurture: unavailable,
      qualifyForOpportunity: unavailable,
      qualifyForDirectSale: unavailable,
    },
  };
}
