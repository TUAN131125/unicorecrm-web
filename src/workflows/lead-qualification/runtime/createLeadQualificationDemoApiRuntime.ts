import { ApplicationError } from "@/shared/domain";
import type { LeadQualificationApiRuntime } from "../application/ports/LeadQualificationApiRuntime";

export function createLeadQualificationDemoApiRuntime(): LeadQualificationApiRuntime {
  const unavailable = async (): Promise<never> => {
    throw new ApplicationError({
      code: "LEAD_QUALIFICATION_HTTP_RUNTIME_UNAVAILABLE",
      message: "The dedicated Lead qualification HTTP runtime is unavailable in demo mode.",
      category: "INFRASTRUCTURE",
      retryable: false,
      userMessage: "Luồng API qualification chỉ khả dụng trong connected mode.",
      details: { module: "lead-qualification", authority: "demo-local-workflow" },
    });
  };
  return {
    mode: "demo",
    commands: {
      qualifyForNurture: unavailable,
      qualifyForOpportunity: unavailable,
      qualifyForDirectSale: unavailable,
    },
  };
}
