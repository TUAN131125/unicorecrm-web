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
  /**
   * The workspace an entry attempt is currently resolving. It exists only so the
   * transport can stamp X-Workspace-Id on the bootstrap/access requests that decide
   * whether the entry is allowed. It never becomes application runtime: the frontend
   * workspace runtime is committed only after those backend responses succeed, and
   * the backend still validates membership on every request.
   */
  private pendingWorkspaceId: string | undefined;
  private readonly workspaceListeners = new Set<WorkspaceListener>();
  private readonly bootstrapListeners = new Set<BootstrapListener>();

  constructor(private readonly gateway: WorkspaceBootstrapGateway) {}

  listMemberships(): WorkspaceMembership[] { return this.memberships.map(cloneMembership); }
  getActiveContext(): WorkspaceBootstrapContext | null { return this.activeContext ? cloneContext(this.activeContext) : null; }
  getActiveWorkspaceId(): string | undefined { return this.activeContext?.workspace.workspaceId ?? this.pendingWorkspaceId; }
  findMembershipById(workspaceId: string): WorkspaceMembership | undefined {
    const membership = this.memberships.find((item) => item.workspaceId === workspaceId);
    return membership ? cloneMembership(membership) : undefined;
  }
  findMembershipByKey(workspaceKey: string): WorkspaceMembership | undefined {
    const membership = this.memberships.find((item) => item.workspaceKey === workspaceKey);
    return membership ? cloneMembership(membership) : undefined;
  }
  getSelectedWorkspaceKey(): string | undefined { return this.storage.get<string>(ACTIVE_WORKSPACE_KEY)?.trim() || undefined; }
  clearSelectedWorkspaceKey(): void { this.storage.remove(ACTIVE_WORKSPACE_KEY); }

  /**
   * Step 1-3 of canonical workspace entry: resolve the requested membership from the
   * authoritative list and read the Workspace bootstrap. Nothing is committed here.
   */
  async prepareEntry(workspaceId: string, signal?: AbortSignal): Promise<WorkspaceBootstrapContext> {
    if (this.memberships.length === 0) await this.loadMemberships(signal);
    const membership = this.memberships.find((item) => item.workspaceId === workspaceId);
    if (!membership) throw new Error(`WORKSPACE_MEMBERSHIP_NOT_FOUND:${workspaceId}`);
    if (membership.status !== "active") throw new Error(`WORKSPACE_MEMBERSHIP_INACTIVE:${workspaceId}`);
    this.pendingWorkspaceId = workspaceId;
    try {
      const context = await this.gateway.getWorkspaceBootstrap(membership.workspaceId, { signal });
      assertContextMatchesMembership(context, membership);
      return cloneContext(context);
    } catch (error) {
      this.pendingWorkspaceId = undefined;
      throw error;
    }
  }

  /** Final step of canonical workspace entry. Only reached once every backend read succeeded. */
  commitEntry(context: WorkspaceBootstrapContext): WorkspaceBootstrapContext {
    const previousId = this.activeContext?.workspace.workspaceId;
    const commit = () => {
      this.activeContext = cloneContext(context);
      this.storage.set(ACTIVE_WORKSPACE_KEY, context.workspace.workspaceKey);
      this.workspaceListeners.forEach((listener) => listener(cloneMembership(context.workspace)));
      this.bootstrapListeners.forEach((listener) => listener(cloneContext(context)));
    };
    if (previousId && previousId !== context.workspace.workspaceId) {
      transitionWorkspaceScope(previousId, context.workspace.workspaceId, commit);
    } else {
      commit();
    }
    this.pendingWorkspaceId = undefined;
    return cloneContext(context);
  }

  abortEntry(): void { this.pendingWorkspaceId = undefined; }
  getSnapshot(): WorkspaceMembership {
    if (!this.activeContext) throw new Error("Connected workspace context has not been resolved.");
    return cloneMembership(this.activeContext.workspace);
  }

  async loadMemberships(signal?: AbortSignal): Promise<WorkspaceMembership[]> {
    const values = await this.gateway.listMyWorkspaces({ signal });
    this.memberships = values.map(cloneMembership);
    if (this.activeContext && !this.memberships.some((membership) => membership.status === "active" && membership.workspaceId === this.activeContext?.workspace.workspaceId)) this.clear();
    return this.listMemberships();
  }

  async ensureInitialWorkspace(signal?: AbortSignal): Promise<void> {
    await this.gateway.ensureInitialWorkspace(signal === undefined ? {} : { signal });
  }

  clear(): void {
    this.activeContext = null;
    this.memberships = [];
    this.pendingWorkspaceId = undefined;
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
