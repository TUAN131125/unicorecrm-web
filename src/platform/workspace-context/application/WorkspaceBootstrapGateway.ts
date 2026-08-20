import type { WorkspaceMembership } from "@/platform/workspace-membership";
import type { WorkspaceBootstrapContext, WorkspaceBootstrapQueryOptions } from "../domain/workspaceBootstrap.types";

export interface WorkspaceBootstrapGateway {
  listMyWorkspaces(options?: WorkspaceBootstrapQueryOptions): Promise<WorkspaceMembership[]>;
  getWorkspaceBootstrap(workspaceId: string, options?: WorkspaceBootstrapQueryOptions): Promise<WorkspaceBootstrapContext>;
}
