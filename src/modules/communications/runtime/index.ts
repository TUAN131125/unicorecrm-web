import type { HttpClient } from "@/platform/api";
import { createChannelManagementApi } from "../infrastructure/http/createChannelManagement";
let channels: ReturnType<typeof createChannelManagementApi> | undefined;
import { createCommunicationsQueries } from "../infrastructure/http/createCommunicationsQueries";
import { pendingCommunicationsQueries } from "../infrastructure/http/PendingCommunicationsQueries";
import { createCommunicationsCommands } from "../infrastructure/http/createCommunicationsCommands";
import type { CommunicationsCommands } from "../application/CommunicationsCommands";
import { createCommunicationsLink } from "../infrastructure/http/createCommunicationsLink";
let link: ReturnType<typeof createCommunicationsLink> | undefined;
let commands: CommunicationsCommands | undefined;
let assigned = pendingCommunicationsQueries;
let queue = pendingCommunicationsQueries;
let closed = pendingCommunicationsQueries;
export function configureCommunicationsHttp(http?: HttpClient) {
  channels = http ? createChannelManagementApi(http) : undefined;
  link = http ? createCommunicationsLink(http) : undefined;
  commands = http ? createCommunicationsCommands(http) : undefined;
  assigned = http ? createCommunicationsQueries(http) : pendingCommunicationsQueries;
  queue = http ? createCommunicationsQueries(http, "unassigned") : pendingCommunicationsQueries;
  closed = http ? createCommunicationsQueries(http, "assigned", "closed") : pendingCommunicationsQueries;
}
export function getCommunicationsQueries(view: "assigned" | "unassigned", statusView: "active" | "closed" = "active") { return view === "unassigned" ? queue : statusView === "closed" ? closed : assigned; }
export function getCommunicationsCommands() { return commands; }
export function getCommunicationsLink() { return link; }
export function getChannelManagement() { return channels; }
