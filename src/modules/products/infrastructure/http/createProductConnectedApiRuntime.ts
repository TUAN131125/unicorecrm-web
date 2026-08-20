import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { ProductApiRuntime } from "../../application/ports/ProductApiRuntime";
import { ProductHttpApiAdapter } from "./ProductHttpApiAdapter";
export function createProductConnectedApiRuntime(httpClient: HttpClient): ProductApiRuntime { const adapter = new ProductHttpApiAdapter(new CommercialApiClient(httpClient)); return { mode: "connected", queries: adapter, commands: adapter }; }
