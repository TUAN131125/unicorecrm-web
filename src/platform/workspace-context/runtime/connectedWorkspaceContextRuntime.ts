import { BrowserStorageAdapter } from "@/platform/persistence";
import { transitionWorkspaceScope } from "@/platform/workspace-scope/workspaceScopeRuntime";
import type { WorkspaceMembership } from "@/platform/workspace-membership";
import type { WorkspaceBootstrapGateway } from "../application/WorkspaceBootstrapGateway";
import type { WorkspaceBootstrapContext } from "../domain/workspaceBootstrap.types";

const ACTIVE_WORKSPACE_KEY = "unicore_connected_active_workspace_key_v1";
type WorkspaceListener = (workspace: WorkspaceMembership) => void;
type BootstrapListener = (context: WorkspaceBootstrapContext | null) => void;

export class ConnectedWorkspaceContextRuntime {
  private readonly storage = new BrowserStorageAdapter(typeof window === "undefined" ? null : window.sessionStorage);
  private memberships: WorkspaceMembership[] = [];
  private activeContext: WorkspaceBootstrapContext | null = null;
  private readonly workspaceListeners = new Set<WorkspaceListener>();
  private readonly bootstrapListeners = new Set<BootstrapListener>();

  constructor(private readonly gateway: WorkspaceBootstrapGateway) {}

  listMemberships(): WorkspaceMembership[] { return this.memberships.map(cloneMembership); }
  getActiveContext(): WorkspaceBootstrapContext | null { return this.activeContext ? cloneContext(this.activeContext) : null; }
  getActiveWorkspaceId(): string | undefined { return this.activeContext?.workspace.workspaceId; }
  getSnapshot(): WorkspaceMembership {
    if (!this.activeContext) throw new Error("Connected workspace context has not been resolved.");
    return cloneMembership(this.activeContext.workspace);
  }

  async loadMemberships(signal?: AbortSignal): Promise<WorkspaceMembership[]> {
    const values = (await this.gateway.listMyWorkspaces({ signal })).filter((membership) => membership.status === "active");
    this.memberships = values.map(cloneMembership);
    if (this.activeContext && !this.memberships.some((membership) => membership.workspaceId === this.activeContext?.workspace.workspaceId)) this.clear();
    return this.listMemberships();
  }

  async restoreSelected(signal?: AbortSignal): Promise<WorkspaceBootstrapContext | null> {
    const workspaceKey = this.storage.get<string>(ACTIVE_WORKSPACE_KEY)?.trim();
    if (!workspaceKey) return null;
    if (this.memberships.length === 0) await this.loadMemberships(signal);
    const membership = this.memberships.find((item) => item.workspaceKey === workspaceKey && item.status === "active");
    if (!membership) { this.storage.remove(ACTIVE_WORKSPACE_KEY); return null; }
    return this.resolve(workspaceKey, signal);
  }

  async resolve(workspaceKey: string, signal?: AbortSignal): Promise<WorkspaceBootstrapContext> {
    if (this.memberships.length === 0) await this.loadMemberships(signal);
    const membership = this.memberships.find((item) => item.workspaceKey === workspaceKey);
    if (!membership) throw new Error(`Workspace membership not found: ${workspaceKey}`);
    if (membership.status !== "active") throw new Error(`Workspace membership is not active: ${workspaceKey}`);
    const context = await this.gateway.getWorkspaceBootstrap(membership.workspaceId, { signal });
    assertContextMatchesMembership(context, membership);
    const previousId = this.activeContext?.workspace.workspaceId;
    const commit = () => {
      this.activeContext = cloneContext(context);
      this.storage.set(ACTIVE_WORKSPACE_KEY, workspaceKey);
      this.workspaceListeners.forEach((listener) => listener(cloneMembership(context.workspace)));
      this.bootstrapListeners.forEach((listener) => listener(cloneContext(context)));
    };
    if (previousId && previousId !== context.workspace.workspaceId) transitionWorkspaceScope(previousId, context.workspace.workspaceId, commit);
    else commit();
    return cloneContext(context);
  }

  clear(): void {
    this.activeContext = null;
    this.memberships = [];
    this.storage.remove(ACTIVE_WORKSPACE_KEY);
    this.bootstrapListeners.forEach((listener) => listener(null));
  }
  subscribeWorkspace(listener: WorkspaceListener): () => void { this.workspaceListeners.add(listener); return () => this.workspaceListeners.delete(listener); }
  subscribeBootstrap(listener: BootstrapListener): () => void { this.bootstrapListeners.add(listener); return () => this.bootstrapListeners.delete(listener); }
}

function assertContextMatchesMembership(context: WorkspaceBootstrapContext, membership: WorkspaceMembership): void {
  if (context.workspace.workspaceId !== membership.workspaceId || context.workspace.workspaceKey !== membership.workspaceKey || context.workspace.membershipId !== membership.membershipId) {
    throw new Error("WORKSPACE_BOOTSTRAP_MEMBERSHIP_MISMATCH");
  }
  if (context.workspace.status !== "active") throw new Error("WORKSPACE_BOOTSTRAP_MEMBERSHIP_INACTIVE");
}
function cloneMembership(value: WorkspaceMembership): WorkspaceMembership { return { ...value, teamIds: [...(value.teamIds ?? [])], roleAssignmentIds: [...(value.roleAssignmentIds ?? [])] }; }
function cloneContext(value: WorkspaceBootstrapContext): WorkspaceBootstrapContext { return { ...value, workspace: cloneMembership(value.workspace), capabilities: [...value.capabilities], configuration: { ...value.configuration, enabledModuleKeys: [...value.configuration.enabledModuleKeys], availableProductSpaces: [...value.configuration.availableProductSpaces] } }; }
