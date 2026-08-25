import { BrowserStorageAdapter } from "@/platform/persistence";
import { listCurrentWorkspaceMemberships } from "@/platform/workspace-membership";
import { transitionWorkspaceScope } from "@/platform/workspace-scope/workspaceScopeRuntime";
import type { WorkspaceBootstrapGateway } from "./application/WorkspaceBootstrapGateway";
import type { WorkspaceBootstrapContext } from "./domain/workspaceBootstrap.types";
import { ConnectedWorkspaceContextRuntime } from "./runtime/connectedWorkspaceContextRuntime";
import { WorkspaceContextStore, type WorkspaceMembership } from "./WorkspaceContextStore";

const demoStore = new WorkspaceContextStore(new BrowserStorageAdapter(), listCurrentWorkspaceMemberships);
let connectedRuntime: ConnectedWorkspaceContextRuntime | undefined;

/**
 * A workspace-scoped runtime that must resolve successfully before the frontend
 * commits a workspace. The AccessControl context is registered here by the
 * application composition root, which keeps this module free of a dependency on
 * the access-control module.
 */
export type WorkspaceRuntimeParticipant = (workspaceId: string, signal?: AbortSignal) => Promise<void>;

let workspaceRuntimeParticipant: WorkspaceRuntimeParticipant | undefined;

export function configureWorkspaceRuntimeParticipant(participant: WorkspaceRuntimeParticipant): void {
  workspaceRuntimeParticipant = participant;
}
export function resetWorkspaceRuntimeParticipant(): void { workspaceRuntimeParticipant = undefined; }

export function configureConnectedWorkspaceBootstrapGateway(gateway: WorkspaceBootstrapGateway): void {
  connectedRuntime?.clear();
  connectedRuntime = new ConnectedWorkspaceContextRuntime(gateway);
}
export function resetConnectedWorkspaceBootstrapGateway(): void { connectedRuntime?.clear(); connectedRuntime = undefined; }
export const isConnectedWorkspaceRuntime = () => connectedRuntime !== undefined;

export const getWorkspaceContextSnapshot = () => connectedRuntime ? connectedRuntime.getSnapshot() : demoStore.getSnapshot();
export const getWorkspaceBootstrapSnapshot = (): WorkspaceBootstrapContext | null => connectedRuntime?.getActiveContext() ?? null;
export const getActiveWorkspaceId = (): string | undefined => connectedRuntime?.getActiveWorkspaceId() ?? safeDemoWorkspaceId();
export const listWorkspaceMemberships = () => connectedRuntime ? connectedRuntime.listMemberships() : demoStore.listMemberships();
export const loadWorkspaceMemberships = (signal?: AbortSignal) => connectedRuntime ? connectedRuntime.loadMemberships(signal) : Promise.resolve(demoStore.listMemberships());
export const findWorkspaceMembership = (workspaceKey: string) => listWorkspaceMemberships().find((membership) => membership.workspaceKey === workspaceKey);

/**
 * The single canonical workspace-entry function.
 *
 * 1. clear the workspace-scoped runtime of the workspace being left;
 * 2. record the requested workspace as the transport scope;
 * 3. GET /workspaces/{workspaceId}/bootstrap;
 * 4. resolve the workspace-scoped runtime participants (AccessControl context);
 * 5. commit the frontend workspace runtime only after both succeeded.
 *
 * Frontend selection is never authority. Every workspace-scoped request still
 * carries X-Workspace-Id and the backend re-validates membership.
 */
export async function enterWorkspace(workspaceId: string, signal?: AbortSignal): Promise<WorkspaceBootstrapContext> {
  if (!connectedRuntime) throw new Error("WORKSPACE_RUNTIME_NOT_CONNECTED");
  const context = await connectedRuntime.prepareEntry(workspaceId, signal);
  try {
    await workspaceRuntimeParticipant?.(workspaceId, signal);
  } catch (error) {
    connectedRuntime.abortEntry();
    throw error;
  }
  return connectedRuntime.commitEntry(context);
}

/** Canonical entry addressed by the workspace key used in canonical routes. */
export async function enterWorkspaceByKey(workspaceKey: string, signal?: AbortSignal): Promise<WorkspaceBootstrapContext> {
  if (!connectedRuntime) throw new Error("WORKSPACE_RUNTIME_NOT_CONNECTED");
  if (!connectedRuntime.findMembershipByKey(workspaceKey)) await connectedRuntime.loadMemberships(signal);
  const membership = connectedRuntime.findMembershipByKey(workspaceKey);
  if (!membership) throw new Error(`WORKSPACE_MEMBERSHIP_NOT_FOUND:${workspaceKey}`);
  return enterWorkspace(membership.workspaceId, signal);
}

/** Re-enters the workspace this browser session last committed, if it is still an active membership. */
export async function restoreSelectedWorkspaceContext(signal?: AbortSignal): Promise<WorkspaceBootstrapContext | null> {
  if (!connectedRuntime) return null;
  const workspaceKey = connectedRuntime.getSelectedWorkspaceKey();
  if (!workspaceKey) return null;
  if (connectedRuntime.listMemberships().length === 0) await connectedRuntime.loadMemberships(signal);
  const membership = connectedRuntime.findMembershipByKey(workspaceKey);
  if (!membership || membership.status !== "active") {
    connectedRuntime.clearSelectedWorkspaceKey();
    return null;
  }
  return enterWorkspace(membership.workspaceId, signal);
}

export async function switchWorkspaceContext(workspaceKey: string, signal?: AbortSignal): Promise<WorkspaceMembership> {
  if (connectedRuntime) return (await enterWorkspaceByKey(workspaceKey, signal)).workspace;
  const previous = demoStore.getSnapshot();
  const next = demoStore.findMembership(workspaceKey);
  if (!next) throw new Error(`Workspace membership not found: ${workspaceKey}`);
  let committed: WorkspaceMembership | undefined;
  transitionWorkspaceScope(previous.workspaceId, next.workspaceId, () => { committed = demoStore.switchTo(workspaceKey); });
  return committed as WorkspaceMembership;
}

export function resetWorkspaceContextSelection(): void {
  if (connectedRuntime) connectedRuntime.clear();
  else demoStore.resetSelection();
}
export const subscribeToWorkspaceContext = (listener: (workspace: WorkspaceMembership) => void) => connectedRuntime ? connectedRuntime.subscribeWorkspace(listener) : demoStore.subscribe(listener);
export const subscribeToWorkspaceBootstrap = (listener: (context: WorkspaceBootstrapContext | null) => void) => connectedRuntime ? connectedRuntime.subscribeBootstrap(listener) : () => undefined;

function safeDemoWorkspaceId(): string | undefined {
  try { return demoStore.getSnapshot().workspaceId; } catch { return undefined; }
}
