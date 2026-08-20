import type { WorkspaceMembership } from "@/platform/workspace-membership";

export type WorkspaceProductSpace = "crm" | "studio" | "people";

export interface WorkspaceRuntimeConfiguration {
  configurationVersion: number;
  locale: "vi" | "en";
  timeZone: string;
  baseCurrency: string;
  enabledModuleKeys: string[];
  availableProductSpaces: WorkspaceProductSpace[];
}

export interface WorkspaceBootstrapContext {
  workspace: WorkspaceMembership;
  contextVersion: number;
  capabilities: string[];
  configuration: WorkspaceRuntimeConfiguration;
  resolvedAt: string;
}

export interface WorkspaceBootstrapQueryOptions {
  signal?: AbortSignal;
}
