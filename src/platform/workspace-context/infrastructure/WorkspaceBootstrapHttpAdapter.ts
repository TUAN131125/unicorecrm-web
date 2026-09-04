import {
  WorkspaceBootstrapApiClient,
  type WorkspaceMembershipSummary,
} from "@/platform/api/generated/workspaceBootstrapApi";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import type { WorkspaceBootstrapGateway } from "../application/WorkspaceBootstrapGateway";
import type { WorkspaceMembership } from "@/platform/workspace-membership";
import type { WorkspaceBootstrapContext, WorkspaceBootstrapQueryOptions } from "../domain/workspaceBootstrap.types";

export class WorkspaceBootstrapHttpAdapter implements WorkspaceBootstrapGateway {
  constructor(private readonly api: WorkspaceBootstrapApiClient) {}

  async listMyWorkspaces(options: WorkspaceBootstrapQueryOptions = {}): Promise<WorkspaceMembership[]> {
    const response = await this.api.listMyWorkspaces({}, options.signal);
    return response.items.map(mapMembership);
  }

  async getWorkspaceBootstrap(workspaceId: string, options: WorkspaceBootstrapQueryOptions = {}): Promise<WorkspaceBootstrapContext> {
    const response = await this.api.getWorkspaceBootstrap(workspaceId, {}, options.signal);
    return {
      workspace: mapMembership(response.workspace),
      contextVersion: response.contextVersion,
      capabilities: [...response.capabilities],
      configuration: {
        configurationVersion: response.configuration.configurationVersion,
        locale: response.configuration.locale,
        timeZone: response.configuration.timeZone,
        baseCurrency: response.configuration.baseCurrency,
        enabledModuleKeys: [...response.configuration.enabledModuleKeys],
        availableProductSpaces: [...response.configuration.availableProductSpaces],
      },
      resolvedAt: response.resolvedAt,
    };
  }
}

function mapMembership(value: WorkspaceMembershipSummary): WorkspaceMembership {
  const principal = getAuthSessionSnapshot()?.principal;
  if (!principal) throw new Error("WORKSPACE_MEMBERSHIP_PRINCIPAL_REQUIRED");
  return {
    membershipId: value.membershipId,
    accountId: principal.accountId,
    memberId: principal.memberId,
    workspaceId: value.workspaceId,
    workspaceKey: value.workspaceKey,
    name: value.name,
    status: value.status,
    logoText: value.logoText,
  };
}

export const listAuthoritativeWorkspaceMemberships = (adapter: WorkspaceBootstrapHttpAdapter) => adapter.listMyWorkspaces();
export const getAuthoritativeWorkspaceBootstrap = (adapter: WorkspaceBootstrapHttpAdapter, workspaceId: string) => adapter.getWorkspaceBootstrap(workspaceId);
