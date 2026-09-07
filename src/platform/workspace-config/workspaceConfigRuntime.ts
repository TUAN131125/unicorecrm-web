import { BrowserStorageAdapter } from "@/platform/persistence";
import { createWorkspaceScopedRepository, registerWorkspaceScopeDisposer, WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import type { CrmModuleVisibilityConfig, CrmWorkspaceConfig } from "./workspaceConfig.types";
import type { WorkspaceConfigRepository } from "./WorkspaceConfigRepository";
import { BrowserWorkspaceConfigRepository } from "./BrowserWorkspaceConfigRepository";

const storage = new BrowserStorageAdapter();
const demoRepository = createWorkspaceScopedRepository<WorkspaceConfigRepository>({
  resourceKey: "workspace_config",
  authorizeReads: false,
  createRepository: (workspaceId) => new BrowserWorkspaceConfigRepository(
    new WorkspaceScopedStorageAdapter(storage, workspaceId, "workspace-config"),
  ),
});

const listeners = new Set<(config: CrmWorkspaceConfig) => void>();
let connectedProjection: CrmWorkspaceConfig | undefined;

demoRepository.subscribe((value) => {
  if (!connectedProjection) emit(value);
});
registerWorkspaceScopeDisposer(() => {
  connectedProjection = undefined;
});

export const getWorkspaceConfigSnapshot = (): CrmWorkspaceConfig => structuredClone(connectedProjection ?? demoRepository.getSnapshot());

export const replaceWorkspaceConfig = (config: CrmWorkspaceConfig): void => {
  assertDemoMutation();
  demoRepository.replace(config);
};

export const updateWorkspaceConfig = (updater: (current: CrmWorkspaceConfig) => CrmWorkspaceConfig): void => {
  assertDemoMutation();
  demoRepository.update(updater);
};

export const resetWorkspaceConfig = (): void => {
  assertDemoMutation();
  demoRepository.reset();
};

export const subscribeToWorkspaceConfig = (listener: (config: CrmWorkspaceConfig) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function replaceConnectedWorkspaceConfigProjection(config: CrmWorkspaceConfig): void {
  connectedProjection = structuredClone(config);
  emit(connectedProjection);
}

export function replaceConnectedWorkspaceModuleProjection(
  workspaceId: string,
  workspaceName: string,
  enabledModuleKeys: readonly string[],
): void {
  const enabled = new Set(enabledModuleKeys);
  const current = getWorkspaceConfigSnapshot();
  const modules: CrmModuleVisibilityConfig = {
    leads: enabled.has("leads"),
    customers: enabled.has("customers"),
    contacts: enabled.has("contacts"),
    deals: enabled.has("deals"),
    quotes: enabled.has("quotes"),
    orders: enabled.has("orders"),
    support: enabled.has("support"),
    organizations: enabled.has("organizations"),
    tasks: enabled.has("tasks"),
    payments: enabled.has("payments"),
    invoices: enabled.has("invoices"),
    shipping: enabled.has("shipping"),
    returns: enabled.has("returns"),
  };
  replaceConnectedWorkspaceConfigProjection({
    ...current,
    workspaceId,
    name: workspaceName,
    modules,
  });
}

export function clearConnectedWorkspaceConfigProjection(): void {
  connectedProjection = undefined;
}

export function isConnectedWorkspaceConfigProjection(): boolean {
  return connectedProjection !== undefined;
}

function assertDemoMutation(): void {
  if (connectedProjection) throw new Error("CONNECTED_WORKSPACE_CONFIG_MUTATION_REQUIRES_STUDIO_API");
}

function emit(value: CrmWorkspaceConfig): void {
  const snapshot = structuredClone(value);
  listeners.forEach((listener) => listener(snapshot));
}
