import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { HttpClient } from "@/platform/api/client";
import type { OrganizationApiRuntime } from "../../application/ports/OrganizationApiRuntime";
import { OrganizationHttpApiAdapter } from "./OrganizationHttpApiAdapter";

export function createOrganizationConnectedApiRuntime(httpClient: HttpClient): OrganizationApiRuntime {
  return { mode: "connected", queries: new OrganizationHttpApiAdapter(new CommercialApiClient(httpClient)) };
}
