import type { HttpClient } from "@/platform/api";
import { CommunicationsApiClient } from "@/platform/api/extensions/communicationsApi";
import type { CommunicationsQueries } from "../../application/CommunicationsQueries";

export function createCommunicationsQueries(http: HttpClient, view: "assigned" | "unassigned" = "assigned", statusView: "active" | "closed" = "active"): CommunicationsQueries {
  const api = new CommunicationsApiClient(http);
  return {
    list: (cursor, signal) => api.list(view, cursor, signal, statusView),
    get: (id, signal) => api.get(id, signal),
    messages: (id, cursor, signal) => api.messages(id, cursor, signal),
  };
}
