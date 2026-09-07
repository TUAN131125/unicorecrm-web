import {
  WorkspaceBootstrapApiClient,
  type WorkspaceMembershipSummary,
} from "@/platform/api/generated/workspaceBootstrapApi";
import { ApiClientError } from "@/platform/api/errors/ApiClientError";
import {
  createProvisioningIdempotencyKey,
  WorkspaceProvisioningApiClient,
} from "@/platform/api/extensions/workspaceProvisioningApi";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import type { WorkspaceBootstrapGateway } from "../application/WorkspaceBootstrapGateway";
import type { WorkspaceMembership } from "@/platform/workspace-membership";
import type { WorkspaceBootstrapContext, WorkspaceBootstrapQueryOptions } from "../domain/workspaceBootstrap.types";

export class WorkspaceBootstrapHttpAdapter implements WorkspaceBootstrapGateway {
  constructor(
    private readonly api: WorkspaceBootstrapApiClient,
    private readonly provisioningApi: WorkspaceProvisioningApiClient,
  ) {}

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

  async ensureInitialWorkspace(options: WorkspaceBootstrapQueryOptions = {}): Promise<"PROVISIONED" | "REPLAYED" | "EXISTING_MEMBERSHIP"> {
    try {
      const response = await this.provisioningApi.provisionInitialWorkspace({}, {
        idempotencyKey: createProvisioningIdempotencyKey(),
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      });
      return response.outcome;
    } catch (error) {
      // A membership committed after the authoritative list read wins. The caller
      // refetches memberships and enters it; this path never promotes that member.
      if (error instanceof ApiClientError
        && error.status === 409
        && error.code === "WORKSPACE_ALREADY_PROVISIONED") {
        return "EXISTING_MEMBERSHIP";
      }
      throw error;
    }
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
