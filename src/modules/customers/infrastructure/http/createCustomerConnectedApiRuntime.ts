import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { HttpClient } from "@/platform/api/client";
import type { CustomerApiRuntime } from "../../application/ports/CustomerApiRuntime";
import { CustomerHttpApiAdapter } from "./CustomerHttpApiAdapter";

export function createCustomerConnectedApiRuntime(httpClient: HttpClient): CustomerApiRuntime {
  return { mode: "connected", queries: new CustomerHttpApiAdapter(new CommercialApiClient(httpClient)) };
}
