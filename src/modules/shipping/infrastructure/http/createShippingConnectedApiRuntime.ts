import type { HttpClient } from "@/platform/api";
import type { ShippingApiRuntime } from "../../application/ports/ShippingApiRuntime";
import { ShippingHttpApiAdapter } from "./ShippingHttpApiAdapter";

export function createShippingConnectedApiRuntime(client: HttpClient): ShippingApiRuntime {
  const adapter = new ShippingHttpApiAdapter(client);
  return { mode: "connected", queries: adapter, commands: adapter };
}
