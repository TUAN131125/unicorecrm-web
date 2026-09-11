import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { HttpClient } from "@/platform/api/client";
import type { CustomerApiRuntime } from "../../application/ports/CustomerApiRuntime";
import { CustomerHttpApiAdapter } from "./CustomerHttpApiAdapter";

export function createCustomerConnectedApiRuntime(httpClient: HttpClient): CustomerApiRuntime {
  const adapter = new CustomerHttpApiAdapter(new CommercialApiClient(httpClient));
  return { mode: "connected", queries: adapter, commands: adapter };
}
