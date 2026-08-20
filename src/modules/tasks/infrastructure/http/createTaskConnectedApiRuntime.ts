import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { TaskApiRuntime } from "../../application/ports/TaskApiRuntime";
import { TaskHttpApiAdapter } from "./TaskHttpApiAdapter";

export function createTaskConnectedApiRuntime(httpClient: HttpClient): TaskApiRuntime {
  const adapter = new TaskHttpApiAdapter(new CommercialApiClient(httpClient));
  return { mode: "connected", queries: adapter, commands: adapter };
}
