import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { QuoteApiRuntime } from "../../application/ports/QuoteApiRuntime";
import { QuoteHttpApiAdapter } from "./QuoteHttpApiAdapter";

export function createQuoteConnectedApiRuntime(httpClient: HttpClient): QuoteApiRuntime {
  const adapter = new QuoteHttpApiAdapter(new CommercialApiClient(httpClient));
  return { mode: "connected", queries: adapter, commands: adapter };
}
