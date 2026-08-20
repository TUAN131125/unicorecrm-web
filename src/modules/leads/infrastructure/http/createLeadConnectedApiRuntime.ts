import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { LeadApiRuntime } from "../../application/ports/LeadApiRuntime";
import { LeadHttpApiAdapter } from "./LeadHttpApiAdapter";

export function createLeadConnectedApiRuntime(httpClient: HttpClient): LeadApiRuntime {
  const adapter = new LeadHttpApiAdapter(new CommercialApiClient(httpClient));
  return {
    mode: "connected",
    queries: adapter,
    commands: adapter,
  };
}
