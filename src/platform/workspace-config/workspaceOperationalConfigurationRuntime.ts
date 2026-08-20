import { BrowserStorageAdapter } from "@/platform/persistence";
import { createWorkspaceScopedRepository, registerWorkspaceScopeDisposer, WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import { BrowserWorkspaceOperationalConfigurationRepository } from "./BrowserWorkspaceOperationalConfigurationRepository";
import type { WorkspaceOperationalConfigurationRepository } from "./WorkspaceOperationalConfigurationRepository";
import type { BusinessAddress, CurrencyConfiguration, ExchangeRate, WorkspaceBusinessInformation, WorkspaceLocaleRegionConfiguration, WorkspaceOperationalConfiguration } from "./workspaceOperationalConfiguration.types";

const storage = new BrowserStorageAdapter();
const demoRepository = createWorkspaceScopedRepository<WorkspaceOperationalConfigurationRepository>({
  resourceKey: "workspace_operational_configuration",
  authorizeReads: false,
  createRepository: (workspaceId) => new BrowserWorkspaceOperationalConfigurationRepository(
    new WorkspaceScopedStorageAdapter(storage, workspaceId, "workspace-operational-configuration"),
  ),
});

const listeners = new Set<(value: WorkspaceOperationalConfiguration) => void>();
let connectedProjection: WorkspaceOperationalConfiguration | undefined;

demoRepository.subscribe((value) => {
  if (!connectedProjection) emit(value);
});
registerWorkspaceScopeDisposer(() => {
  connectedProjection = undefined;
});

export const getWorkspaceOperationalConfiguration = (): WorkspaceOperationalConfiguration => structuredClone(connectedProjection ?? demoRepository.getSnapshot());
export const subscribeToWorkspaceOperationalConfiguration = (listener: (value: WorkspaceOperationalConfiguration) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const updateWorkspaceOperationalConfiguration = (updater: (current: WorkspaceOperationalConfiguration) => WorkspaceOperationalConfiguration) => {
  assertDemoMutation();
  return demoRepository.update(updater);
};

export const updateWorkspaceBusinessInformation = (value: WorkspaceBusinessInformation) => updateWorkspaceOperationalConfiguration((current) => ({ ...current, businessInformation: value }));
export const updateWorkspaceBusinessAddresses = (value: BusinessAddress[]) => updateWorkspaceOperationalConfiguration((current) => ({ ...current, addresses: value }));
export const updateWorkspaceLocaleRegion = (value: WorkspaceLocaleRegionConfiguration) => updateWorkspaceOperationalConfiguration((current) => ({ ...current, localeRegion: value }));
export const updateWorkspaceCurrencyConfiguration = (value: CurrencyConfiguration) => updateWorkspaceOperationalConfiguration((current) => ({ ...current, localeRegion: { ...current.localeRegion, currencies: value } }));
export const updateWorkspaceExchangeRates = (value: ExchangeRate[]) => updateWorkspaceOperationalConfiguration((current) => ({ ...current, localeRegion: { ...current.localeRegion, exchangeRates: value } }));

export function replaceConnectedWorkspaceOperationalConfigurationProjection(value: WorkspaceOperationalConfiguration): void {
  connectedProjection = structuredClone(value);
  emit(connectedProjection);
}

export function clearConnectedWorkspaceOperationalConfigurationProjection(): void {
  connectedProjection = undefined;
}

export function isConnectedWorkspaceOperationalConfigurationProjection(): boolean {
  return connectedProjection !== undefined;
}

function assertDemoMutation(): void {
  if (connectedProjection) throw new Error("CONNECTED_WORKSPACE_OPERATIONAL_CONFIG_MUTATION_REQUIRES_STUDIO_API");
}

function emit(value: WorkspaceOperationalConfiguration): void {
  const snapshot = structuredClone(value);
  listeners.forEach((listener) => listener(snapshot));
}
