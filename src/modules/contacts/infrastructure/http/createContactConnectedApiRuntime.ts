import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { HttpClient } from "@/platform/api/client";
import type { ContactApiRuntime } from "../../application/ports/ContactApiRuntime";
import { ContactHttpApiAdapter } from "./ContactHttpApiAdapter";
import { declareUnavailableBusinessOperation } from "@/shared/application";
import { CONTACT_CREATE_OPERATION, CONTACT_UPDATE_OPERATION } from "../../application/ports/ContactApiRuntime";

export function createContactConnectedApiRuntime(httpClient: HttpClient): ContactApiRuntime {
  declareUnavailableBusinessOperation(CONTACT_CREATE_OPERATION);
  declareUnavailableBusinessOperation(CONTACT_UPDATE_OPERATION);
  return { mode: "connected", queries: new ContactHttpApiAdapter(new CommercialApiClient(httpClient)) };
}
