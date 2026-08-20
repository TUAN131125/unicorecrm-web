import type { StoragePort } from "@/platform/persistence";
import type { WorkspaceMembership } from "@/platform/workspace-membership";

export type { WorkspaceMembership } from "@/platform/workspace-membership";
export type WorkspaceMembershipStatus = WorkspaceMembership["status"];
export type WorkspaceContextListener = (workspace: WorkspaceMembership) => void;

type MembershipSource = readonly WorkspaceMembership[] | (() => readonly WorkspaceMembership[]);

export class WorkspaceContextStore {
  private readonly listeners = new Set<WorkspaceContextListener>();

  constructor(
    private readonly storage: StoragePort,
    private readonly membershipSource: MembershipSource,
    private readonly storageKey = "unicore_active_workspace_key_v2",
  ) {}

  listMemberships(): WorkspaceMembership[] {
    return this.memberships().map(cloneMembership);
  }

  getSnapshot(): WorkspaceMembership {
    const memberships = this.memberships();
    if (memberships.length === 0) {
      throw new Error("No workspace membership is available for the authenticated account.");
    }
    const storedKey = this.storage.get<string>(this.storageKey);
    const storedMembership = storedKey
      ? memberships.find((membership) => membership.workspaceKey === storedKey && membership.status === "active")
      : undefined;
    return cloneMembership(storedMembership || this.firstActiveMembership(memberships));
  }

  findMembership(workspaceKey: string): WorkspaceMembership | undefined {
    const membership = this.memberships().find((item) => item.workspaceKey === workspaceKey);
    return membership ? cloneMembership(membership) : undefined;
  }

  switchTo(workspaceKey: string): WorkspaceMembership {
    const membership = this.memberships().find((item) => item.workspaceKey === workspaceKey);
    if (!membership) throw new Error(`Workspace membership not found: ${workspaceKey}`);
    if (membership.status !== "active") throw new Error(`Workspace membership is not active: ${workspaceKey}`);
    this.storage.set(this.storageKey, workspaceKey);
    const snapshot = cloneMembership(membership);
    this.listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }

  resetSelection(): void {
    this.storage.remove(this.storageKey);
  }

  subscribe(listener: WorkspaceContextListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private memberships(): readonly WorkspaceMembership[] {
    return typeof this.membershipSource === "function" ? this.membershipSource() : this.membershipSource;
  }

  private firstActiveMembership(memberships: readonly WorkspaceMembership[]): WorkspaceMembership {
    const active = memberships.find((membership) => membership.status === "active");
    if (!active) throw new Error("No active workspace membership is available.");
    return active;
  }
}

function cloneMembership(membership: WorkspaceMembership): WorkspaceMembership {
  return {
    ...membership,
    teamIds: [...(membership.teamIds || [])],
    roleAssignmentIds: [...(membership.roleAssignmentIds || [])],
  };
}
