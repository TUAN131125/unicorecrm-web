import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { LeadQualificationApiRuntime } from "../../application/ports/LeadQualificationApiRuntime";
import { LeadQualificationHttpAdapter } from "./LeadQualificationHttpAdapter";

export function createLeadQualificationConnectedApiRuntime(httpClient: HttpClient): LeadQualificationApiRuntime {
  return {
    mode: "connected",
    commands: new LeadQualificationHttpAdapter(new CommercialApiClient(httpClient)),
  };
}
