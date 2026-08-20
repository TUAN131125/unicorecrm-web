import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { HttpClient } from "@/platform/api/client";
import type { ContactApiRuntime } from "../../application/ports/ContactApiRuntime";
import { ContactHttpApiAdapter } from "./ContactHttpApiAdapter";

export function createContactConnectedApiRuntime(httpClient: HttpClient): ContactApiRuntime {
  return { mode: "connected", queries: new ContactHttpApiAdapter(new CommercialApiClient(httpClient)) };
}
