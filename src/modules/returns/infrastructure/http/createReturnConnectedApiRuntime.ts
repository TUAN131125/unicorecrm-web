import type { HttpClient } from "@/platform/api";
import type { ReturnApiRuntime } from "../../application/ports/ReturnApiRuntime";
import { ReturnHttpApiAdapter } from "./ReturnHttpApiAdapter";

export function createReturnConnectedApiRuntime(client: HttpClient): ReturnApiRuntime {
  const adapter = new ReturnHttpApiAdapter(client);
  return { mode: "connected", queries: adapter, commands: adapter };
}
