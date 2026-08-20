import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { OrderApiRuntime } from "../../application/ports/OrderApiRuntime";
import { OrderHttpApiAdapter } from "./OrderHttpApiAdapter";
export function createOrderConnectedApiRuntime(httpClient: HttpClient): OrderApiRuntime { const adapter = new OrderHttpApiAdapter(new CommercialApiClient(httpClient)); return { mode: "connected", queries: adapter, commands: adapter }; }
