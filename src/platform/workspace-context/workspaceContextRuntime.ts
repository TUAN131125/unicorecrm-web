import { BrowserStorageAdapter } from "@/platform/persistence";
import { listCurrentWorkspaceMemberships } from "@/platform/workspace-membership";
import { transitionWorkspaceScope } from "@/platform/workspace-scope/workspaceScopeRuntime";
import type { WorkspaceBootstrapGateway } from "./application/WorkspaceBootstrapGateway";
import type { WorkspaceBootstrapContext } from "./domain/workspaceBootstrap.types";
import { ConnectedWorkspaceContextRuntime } from "./runtime/connectedWorkspaceContextRuntime";
import { WorkspaceContextStore, type WorkspaceMembership } from "./WorkspaceContextStore";

const demoStore = new WorkspaceContextStore(new BrowserStorageAdapter(), listCurrentWorkspaceMemberships);
let connectedRuntime: ConnectedWorkspaceContextRuntime | undefined;

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
export const restoreSelectedWorkspaceContext = (signal?: AbortSignal) => connectedRuntime ? connectedRuntime.restoreSelected(signal) : Promise.resolve(null);

export async function switchWorkspaceContext(workspaceKey: string, signal?: AbortSignal): Promise<WorkspaceMembership> {
  if (connectedRuntime) return (await connectedRuntime.resolve(workspaceKey, signal)).workspace;
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
