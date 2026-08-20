import { WorkspaceScopeCoordinator } from "./WorkspaceScopeCoordinator";

const coordinator = new WorkspaceScopeCoordinator();

export const registerWorkspaceScopeDisposer = (disposer: () => void) => coordinator.registerScopeDisposer(disposer);
export const transitionWorkspaceScope = (previousWorkspaceId: string | undefined, nextWorkspaceId: string, commitContext: () => void) => coordinator.transition(previousWorkspaceId, nextWorkspaceId, commitContext);
export const getWorkspaceScopeRevision = () => coordinator.getRevision();
export const subscribeToWorkspaceScope = (listener: Parameters<WorkspaceScopeCoordinator["subscribe"]>[0]) => coordinator.subscribe(listener);
