import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { HttpClient } from "@/platform/api/client";
import type { ContactApiRuntime } from "../../application/ports/ContactApiRuntime";
import { ContactHttpApiAdapter } from "./ContactHttpApiAdapter";
import { ContactHttpCommandAdapter } from "./ContactHttpCommandAdapter";

export function createContactConnectedApiRuntime(httpClient: HttpClient): ContactApiRuntime {
  const api = new CommercialApiClient(httpClient);
  return { mode: "connected", queries: new ContactHttpApiAdapter(api), commands: new ContactHttpCommandAdapter(api) };
}
