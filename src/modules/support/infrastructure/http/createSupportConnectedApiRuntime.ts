import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { SupportApiRuntime } from "../../application/ports/SupportApiRuntime";
import { SupportHttpApiAdapter } from "./SupportHttpApiAdapter";

export function createSupportConnectedApiRuntime(httpClient: HttpClient): SupportApiRuntime {
  const adapter = new SupportHttpApiAdapter(new CommercialApiClient(httpClient));
  return { mode: "connected", queries: adapter, commands: adapter };
}
