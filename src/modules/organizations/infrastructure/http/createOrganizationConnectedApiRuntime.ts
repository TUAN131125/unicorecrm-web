import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { HttpClient } from "@/platform/api/client";
import type { OrganizationApiRuntime } from "../../application/ports/OrganizationApiRuntime";
import { OrganizationHttpApiAdapter } from "./OrganizationHttpApiAdapter";
import { OrganizationHttpCommandAdapter } from "./OrganizationHttpCommandAdapter";

export function createOrganizationConnectedApiRuntime(httpClient: HttpClient): OrganizationApiRuntime {
  const client = new CommercialApiClient(httpClient);
  return { mode: "connected", queries: new OrganizationHttpApiAdapter(client), commands: new OrganizationHttpCommandAdapter(client) };
}
