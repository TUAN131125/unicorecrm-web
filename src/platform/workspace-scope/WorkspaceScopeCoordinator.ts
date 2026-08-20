export type WorkspaceScopePhase = "DISPOSING" | "INVALIDATING" | "LOADING" | "READY";
export interface WorkspaceScopeEvent {
  previousWorkspaceId?: string;
  nextWorkspaceId: string;
  phase: WorkspaceScopePhase;
  revision: number;
}

type ScopeListener = (event: WorkspaceScopeEvent) => void;
type ScopeDisposer = () => void;

export class WorkspaceScopeCoordinator {
  private readonly listeners = new Set<ScopeListener>();
  private readonly disposers = new Set<ScopeDisposer>();
  private revision = 0;

  registerScopeDisposer(disposer: ScopeDisposer): () => void {
    this.disposers.add(disposer);
    return () => this.disposers.delete(disposer);
  }

  transition(previousWorkspaceId: string | undefined, nextWorkspaceId: string, commitContext: () => void): void {
    this.revision += 1;
    this.emit(previousWorkspaceId, nextWorkspaceId, "DISPOSING");
    const pending = [...this.disposers];
    pending.forEach((dispose) => dispose());

    this.emit(previousWorkspaceId, nextWorkspaceId, "INVALIDATING");
    commitContext();
    this.emit(previousWorkspaceId, nextWorkspaceId, "LOADING");
    this.emit(previousWorkspaceId, nextWorkspaceId, "READY");
  }

  getRevision(): number { return this.revision; }

  subscribe(listener: ScopeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(previousWorkspaceId: string | undefined, nextWorkspaceId: string, phase: WorkspaceScopePhase): void {
    const event = { previousWorkspaceId, nextWorkspaceId, phase, revision: this.revision };
    this.listeners.forEach((listener) => listener(event));
  }
}
