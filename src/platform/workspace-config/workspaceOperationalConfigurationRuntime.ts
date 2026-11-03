import { BrowserStorageAdapter } from "@/platform/persistence";
import { createWorkspaceScopedRepository, registerWorkspaceScopeDisposer, WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import { BrowserWorkspaceOperationalConfigurationRepository, createDefaultWorkspaceOperationalConfiguration } from "./BrowserWorkspaceOperationalConfigurationRepository";
import { getActiveWorkspaceId } from "@/platform/workspace-context";
import type { WorkspaceOperationalConfigurationRepository } from "./WorkspaceOperationalConfigurationRepository";
import type { BusinessAddress, CurrencyConfiguration, ExchangeRate, WorkspaceBusinessInformation, WorkspaceLocaleRegionConfiguration, WorkspaceOperationalConfiguration } from "./workspaceOperationalConfiguration.types";
import { ApplicationError } from "@/shared/domain";
import { captureWorkspaceConfigurationOwner, configureDemoWorkspaceRuntimeSettingsReader, notifyDemoWorkspaceRuntimeSettings, isConnectedWorkspaceRuntimeSettings, isCurrentWorkspaceConfigurationOwner, publishWorkspaceRuntimeLocale, type WorkspaceConfigurationOwner } from "./workspaceRuntimeSettings";

const storage = new BrowserStorageAdapter();
const demoRepository = createWorkspaceScopedRepository<WorkspaceOperationalConfigurationRepository>({
  resourceKey: "workspace_operational_configuration",
  authorizeReads: false,
  createRepository: (workspaceId) => new BrowserWorkspaceOperationalConfigurationRepository(
    new WorkspaceScopedStorageAdapter(storage, workspaceId, "workspace-operational-configuration"),
  ),
});
configureDemoWorkspaceRuntimeSettingsReader(() => getActiveWorkspaceId() ? getWorkspaceOperationalConfiguration() : createDefaultWorkspaceOperationalConfiguration());

const listeners = new Set<(value: WorkspaceOperationalConfiguration) => void>();
let connectedProjection: WorkspaceOperationalConfiguration | undefined;
let projectionOwner: WorkspaceConfigurationOwner | undefined;
let stateOwner: WorkspaceConfigurationOwner | undefined;
let loader: ((signal: AbortSignal) => Promise<WorkspaceOperationalConfiguration>) | undefined;
let pending: { owner: WorkspaceConfigurationOwner; controller: AbortController; promise: Promise<void> } | undefined;
let failure: ApplicationError | undefined;
let revision = 0;
const stateListeners = new Set<() => void>();

demoRepository.subscribe((value) => {
  if (!connectedProjection) emit(value);
});
registerWorkspaceScopeDisposer(() => {
  clearConnectedWorkspaceOperationalConfigurationProjection();
});

export const getWorkspaceOperationalConfiguration = (): WorkspaceOperationalConfiguration => {
  if (connectedProjection && (!isConnectedWorkspaceRuntimeSettings() || (projectionOwner && isCurrentWorkspaceConfigurationOwner(projectionOwner)))) return structuredClone(connectedProjection);
  if (loader || isConnectedWorkspaceRuntimeSettings()) throw configurationUnavailable();
  return demoRepository.getSnapshot();
};

/** Full configuration is deferred to consumers that need it, independently of Studio UI. */
export function configureWorkspaceOperationalConfigurationLoader(value?: (signal: AbortSignal) => Promise<WorkspaceOperationalConfiguration>): void {
  clearConnectedWorkspaceOperationalConfigurationProjection();
  loader = value;
}

export function readWorkspaceOperationalConfiguration(): WorkspaceOperationalConfiguration {
  if (!loader) return getWorkspaceOperationalConfiguration();
  const owner = captureWorkspaceConfigurationOwner();
  if (stateOwner && !isCurrentWorkspaceConfigurationOwner(stateOwner)) clearConnectedWorkspaceOperationalConfigurationProjection();
  if (connectedProjection && projectionOwner && isCurrentWorkspaceConfigurationOwner(projectionOwner)) return getWorkspaceOperationalConfiguration();
  if (pending && !isCurrentWorkspaceConfigurationOwner(pending.owner)) clearConnectedWorkspaceOperationalConfigurationProjection();
  if (failure) throw failure;
  if (!pending) {
    const controller = new AbortController();
    const request = { owner, controller, promise: Promise.resolve() };
    stateOwner = owner;
    pending = request;
    request.promise = loader(controller.signal).then((value) => {
      if (pending === request && isCurrentWorkspaceConfigurationOwner(owner)) replaceConnectedWorkspaceOperationalConfigurationProjection(value, owner);
    }, () => {
      if (pending === request && isCurrentWorkspaceConfigurationOwner(owner)) failure = configurationUnavailable();
    }).finally(() => {
      if (pending === request) { pending = undefined; notifyState(); }
    });
  }
  throw pending.promise;
}

export const getWorkspaceOperationalConfigurationRevision = (): number => revision;
export const subscribeToWorkspaceOperationalConfigurationState = (listener: () => void): (() => void) => {
  stateListeners.add(listener); return () => stateListeners.delete(listener);
};
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

export function replaceConnectedWorkspaceOperationalConfigurationProjection(value: WorkspaceOperationalConfiguration, owner = captureWorkspaceConfigurationOwner()): void {
  if (!isCurrentWorkspaceConfigurationOwner(owner)) throw configurationUnavailable();
  publishWorkspaceRuntimeLocale(value.localeRegion.currencies.baseCurrency, value.localeRegion.timezone, owner, value.revision);
  pending?.controller.abort();
  pending = undefined;
  failure = undefined;
  projectionOwner = owner;
  stateOwner = owner;
  connectedProjection = structuredClone(value);
  emit(connectedProjection);
}

export function clearConnectedWorkspaceOperationalConfigurationProjection(): void {
  pending?.controller.abort();
  pending = undefined;
  failure = undefined;
  connectedProjection = undefined;
  projectionOwner = undefined;
  stateOwner = undefined;
  notifyState();
}

export function isConnectedWorkspaceOperationalConfigurationProjection(): boolean {
  return connectedProjection !== undefined && projectionOwner !== undefined && isCurrentWorkspaceConfigurationOwner(projectionOwner);
}

function assertDemoMutation(): void {
  if (loader || isConnectedWorkspaceRuntimeSettings() || connectedProjection) throw new Error("CONNECTED_WORKSPACE_OPERATIONAL_CONFIG_MUTATION_REQUIRES_STUDIO_API");
}

function emit(value: WorkspaceOperationalConfiguration): void {
  const snapshot = structuredClone(value);
  listeners.forEach((listener) => listener(snapshot));
  notifyState();
  notifyDemoWorkspaceRuntimeSettings();
}

function notifyState(): void { revision += 1; stateListeners.forEach((listener) => listener()); }
function configurationUnavailable(): ApplicationError {
  return new ApplicationError({ code: "WORKSPACE_CONFIGURATION_UNAVAILABLE", category: "INFRASTRUCTURE",
    message: "Workspace configuration authority is unavailable.", retryable: true });
}
