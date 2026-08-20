import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { DealApiRuntime } from "../../application/ports/DealApiRuntime";
import { DealHttpApiAdapter } from "./DealHttpApiAdapter";

export function createDealConnectedApiRuntime(httpClient: HttpClient): DealApiRuntime {
  const adapter = new DealHttpApiAdapter(new CommercialApiClient(httpClient));
  return { mode: "connected", queries: adapter, commands: adapter };
}
