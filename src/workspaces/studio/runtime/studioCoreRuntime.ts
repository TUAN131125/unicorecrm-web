import { BrowserStorageAdapter } from "@/platform/persistence/BrowserStorageAdapter";
import type { CrmModuleVisibilityConfig, CrmWorkspaceConfig } from "@/platform/workspace-config/workspaceConfig.types";
import {
  clearConnectedWorkspaceConfigProjection,
  getWorkspaceConfigSnapshot,
  replaceConnectedWorkspaceConfigProjection,
  updateWorkspaceConfig,
} from "@/platform/workspace-config/workspaceConfigRuntime";
import type {
  BusinessAddress,
  WorkspaceBusinessInformation,
  WorkspaceLocaleRegionConfiguration,
} from "@/platform/workspace-config/workspaceOperationalConfiguration.types";
import {
  clearConnectedWorkspaceOperationalConfigurationProjection,
  getWorkspaceOperationalConfiguration,
  replaceConnectedWorkspaceOperationalConfigurationProjection,
  updateWorkspaceOperationalConfiguration,
} from "@/platform/workspace-config/workspaceOperationalConfigurationRuntime";
import { getActiveWorkspaceId } from "@/platform/workspace-context/workspaceContextRuntime";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";
import { registerWorkspaceScopeDisposer } from "@/platform/workspace-scope/workspaceScopeRuntime";
import type { StudioCoreGateway } from "../application/StudioCoreGateway";
import type { QuickSetupRepository } from "../application/QuickSetupRepository";
import type { QuickSetupState, QuickSetupStepId } from "../application/quickSetup.types";
import {
  type StudioCommandOptions,
  type StudioConfigurationAuditEntry,
  type StudioConfigurationMutationResult,
  type StudioCoreConfiguration,
  type StudioCoreRuntime,
  type StudioQuickSetupMutationResult,
  toOperationalConfiguration,
} from "../application/studioCore.types";
import { BrowserQuickSetupRepository } from "../infrastructure/BrowserQuickSetupRepository";

class ConnectedStudioCoreRuntime implements StudioCoreRuntime {
  readonly mode = "connected" as const;
  private configuration: StudioCoreConfiguration | undefined;
  private quickSetup: QuickSetupState | undefined;
  private readonly configurationListeners = new Set<(configuration: StudioCoreConfiguration) => void>();
  private readonly quickSetupListeners = new Set<(state: QuickSetupState) => void>();

  constructor(private readonly gateway: StudioCoreGateway) {}

  async loadConfiguration(signal?: AbortSignal): Promise<StudioCoreConfiguration> {
    const value = await this.gateway.getConfiguration(signal);
    this.commitConfiguration(value);
    return this.getConfiguration();
  }

  getConfiguration(): StudioCoreConfiguration {
    if (!this.configuration) throw new Error("STUDIO_CORE_CONFIGURATION_NOT_LOADED");
    return structuredClone(this.configuration);
  }

  subscribeConfiguration(listener: (configuration: StudioCoreConfiguration) => void): () => void {
    this.configurationListeners.add(listener);
    return () => this.configurationListeners.delete(listener);
  }

  async updateBusinessInformation(
    businessInformation: WorkspaceBusinessInformation,
    addresses: BusinessAddress[],
    options?: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult> {
    return this.commitMutation(await this.gateway.updateBusinessInformation(
      businessInformation,
      addresses,
      this.resolveOptions("business-information", options),
    ));
  }

  async updateLocaleRegion(
    localeRegion: WorkspaceLocaleRegionConfiguration,
    options?: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult> {
    return this.commitMutation(await this.gateway.updateLocaleRegion(
      localeRegion,
      this.resolveOptions("locale-region", options),
    ));
  }

  async updateBlueprint(
    blueprint: Pick<CrmWorkspaceConfig, "businessModel" | "workflow">,
    features: CrmModuleVisibilityConfig,
    options?: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult> {
    return this.commitMutation(await this.gateway.updateBlueprint(
      blueprint,
      features,
      this.resolveOptions("blueprint", options),
    ));
  }

  async updateFeatures(
    features: CrmModuleVisibilityConfig,
    options?: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult> {
    return this.commitMutation(await this.gateway.updateFeatures(
      features,
      this.resolveOptions("features", options),
    ));
  }

  async publish(note: string | undefined, options?: StudioCommandOptions): Promise<StudioConfigurationMutationResult> {
    return this.commitMutation(await this.gateway.publish(note, this.resolveOptions("publish", options)));
  }

  listAudit(signal?: AbortSignal): Promise<StudioConfigurationAuditEntry[]> {
    return this.gateway.listAudit(signal);
  }

  async loadQuickSetup(signal?: AbortSignal): Promise<QuickSetupState> {
    const state = await this.gateway.getQuickSetup(signal);
    this.commitQuickSetup(state);
    return this.getQuickSetup();
  }

  getQuickSetup(): QuickSetupState {
    if (!this.quickSetup) throw new Error("STUDIO_QUICK_SETUP_NOT_LOADED");
    return structuredClone(this.quickSetup);
  }

  subscribeQuickSetup(listener: (state: QuickSetupState) => void): () => void {
    this.quickSetupListeners.add(listener);
    return () => this.quickSetupListeners.delete(listener);
  }

  async openQuickSetup(options?: StudioCommandOptions): Promise<StudioQuickSetupMutationResult> {
    return this.commitQuickSetupMutation(await this.gateway.openQuickSetup(this.resolveQuickSetupOptions("open", options)));
  }

  async dismissQuickSetupAutoOpen(options?: StudioCommandOptions): Promise<StudioQuickSetupMutationResult> {
    return this.commitQuickSetupMutation(await this.gateway.dismissQuickSetupAutoOpen(this.resolveQuickSetupOptions("dismiss", options)));
  }

  async completeQuickSetupStep(stepId: QuickSetupStepId, options?: StudioCommandOptions): Promise<StudioQuickSetupMutationResult> {
    return this.commitQuickSetupMutation(await this.gateway.completeQuickSetupStep(stepId, this.resolveQuickSetupOptions(`complete-${stepId}`, options)));
  }

  async skipQuickSetupStep(stepId: QuickSetupStepId, options?: StudioCommandOptions): Promise<StudioQuickSetupMutationResult> {
    return this.commitQuickSetupMutation(await this.gateway.skipQuickSetupStep(stepId, this.resolveQuickSetupOptions(`skip-${stepId}`, options)));
  }

  clear(): void {
    this.configuration = undefined;
    this.quickSetup = undefined;
    clearConnectedWorkspaceConfigProjection();
    clearConnectedWorkspaceOperationalConfigurationProjection();
  }

  private resolveOptions(purpose: string, options?: StudioCommandOptions): StudioCommandOptions {
    const configuration = this.getConfiguration();
    return options ?? {
      idempotencyKey: createIdempotencyKey(`studio-${purpose}`),
      expectedVersion: configuration.revision,
    };
  }

  private resolveQuickSetupOptions(purpose: string, options?: StudioCommandOptions): StudioCommandOptions {
    const state = this.getQuickSetup();
    return options ?? {
      idempotencyKey: createIdempotencyKey(`studio-quick-${purpose}`),
      expectedVersion: state.revision,
    };
  }

  private commitMutation(result: StudioConfigurationMutationResult): StudioConfigurationMutationResult {
    this.commitConfiguration(result.configuration);
    return structuredClone(result);
  }

  private commitConfiguration(value: StudioCoreConfiguration): void {
    this.configuration = structuredClone(value);
    const current = getWorkspaceConfigSnapshot();
    replaceConnectedWorkspaceConfigProjection({
      ...current,
      workspaceId: value.workspaceId,
      name: value.businessInformation.displayName,
      businessModel: value.blueprint.businessModel,
      workflow: structuredClone(value.blueprint.workflow),
      modules: structuredClone(value.features),
    });
    replaceConnectedWorkspaceOperationalConfigurationProjection(toOperationalConfiguration(value));
    const snapshot = this.getConfiguration();
    this.configurationListeners.forEach((listener) => listener(snapshot));
  }

  private commitQuickSetupMutation(result: StudioQuickSetupMutationResult): StudioQuickSetupMutationResult {
    this.commitQuickSetup(result.state);
    return structuredClone(result);
  }

  private commitQuickSetup(value: QuickSetupState): void {
    this.quickSetup = structuredClone(value);
    const snapshot = this.getQuickSetup();
    this.quickSetupListeners.forEach((listener) => listener(snapshot));
  }
}

class DemoStudioCoreRuntime implements StudioCoreRuntime {
  readonly mode = "demo" as const;
  private publicationStatus: StudioCoreConfiguration["publicationStatus"] = "DRAFT";
  private publishedRevision: number | undefined;
  private readonly configurationListeners = new Set<(configuration: StudioCoreConfiguration) => void>();
  private readonly quickStorage = new BrowserStorageAdapter();
  private readonly quickRepository = createWorkspaceScopedRepository<QuickSetupRepository>({
    resourceKey: "studio_quick_setup",
    authorizeReads: false,
    createRepository: (workspaceId) => new BrowserQuickSetupRepository(
      new WorkspaceScopedStorageAdapter(this.quickStorage, workspaceId, "studio"),
    ),
  });

  loadConfiguration(): Promise<StudioCoreConfiguration> { return Promise.resolve(this.getConfiguration()); }
  getConfiguration(): StudioCoreConfiguration {
    const operational = getWorkspaceOperationalConfiguration();
    const workspace = getWorkspaceConfigSnapshot();
    return {
      workspaceId: getActiveWorkspaceId() ?? workspace.workspaceId,
      revision: operational.revision,
      publicationStatus: this.publicationStatus,
      ...(this.publishedRevision === undefined ? {} : { publishedRevision: this.publishedRevision }),
      businessInformation: structuredClone(operational.businessInformation),
      addresses: structuredClone(operational.addresses),
      localeRegion: structuredClone(operational.localeRegion),
      blueprint: { businessModel: workspace.businessModel, workflow: structuredClone(workspace.workflow) },
      features: structuredClone(workspace.modules),
      updatedAt: operational.updatedAt,
    };
  }
  subscribeConfiguration(listener: (configuration: StudioCoreConfiguration) => void): () => void { this.configurationListeners.add(listener); return () => this.configurationListeners.delete(listener); }

  async updateBusinessInformation(businessInformation: WorkspaceBusinessInformation, addresses: BusinessAddress[]): Promise<StudioConfigurationMutationResult> {
    updateWorkspaceOperationalConfiguration((current) => ({ ...current, businessInformation, addresses }));
    return this.syntheticConfigurationMutation("business-information");
  }
  async updateLocaleRegion(localeRegion: WorkspaceLocaleRegionConfiguration): Promise<StudioConfigurationMutationResult> {
    updateWorkspaceOperationalConfiguration((current) => ({ ...current, localeRegion }));
    return this.syntheticConfigurationMutation("locale-region");
  }
  async updateBlueprint(blueprint: Pick<CrmWorkspaceConfig, "businessModel" | "workflow">, features: CrmModuleVisibilityConfig): Promise<StudioConfigurationMutationResult> {
    updateWorkspaceConfig((current) => ({ ...current, businessModel: blueprint.businessModel, workflow: blueprint.workflow, modules: features }));
    return this.syntheticConfigurationMutation("blueprint");
  }
  async updateFeatures(features: CrmModuleVisibilityConfig): Promise<StudioConfigurationMutationResult> {
    updateWorkspaceConfig((current) => ({ ...current, modules: features }));
    return this.syntheticConfigurationMutation("features");
  }
  async publish(): Promise<StudioConfigurationMutationResult> {
    this.publicationStatus = "PUBLISHED";
    this.publishedRevision = this.getConfiguration().revision;
    return this.syntheticConfigurationMutation("publish");
  }
  listAudit(): Promise<StudioConfigurationAuditEntry[]> { return Promise.resolve([]); }

  loadQuickSetup(): Promise<QuickSetupState> { return Promise.resolve(this.quickRepository.getState()); }
  getQuickSetup(): QuickSetupState { return this.quickRepository.getState(); }
  subscribeQuickSetup(listener: (state: QuickSetupState) => void): () => void { return this.quickRepository.subscribe(listener); }
  async openQuickSetup(): Promise<StudioQuickSetupMutationResult> { return this.syntheticQuickSetupMutation("open", this.quickRepository.open()); }
  async dismissQuickSetupAutoOpen(): Promise<StudioQuickSetupMutationResult> { return this.syntheticQuickSetupMutation("dismiss", this.quickRepository.dismissAutoOpen()); }
  async completeQuickSetupStep(stepId: QuickSetupStepId): Promise<StudioQuickSetupMutationResult> { return this.syntheticQuickSetupMutation(`complete-${stepId}`, this.quickRepository.completeStep(stepId)); }
  async skipQuickSetupStep(stepId: QuickSetupStepId): Promise<StudioQuickSetupMutationResult> { return this.syntheticQuickSetupMutation(`skip-${stepId}`, this.quickRepository.skipStep(stepId)); }
  clear(): void {}

  private syntheticConfigurationMutation(purpose: string): StudioConfigurationMutationResult {
    const configuration = this.getConfiguration();
    const result: StudioConfigurationMutationResult = {
      commandId: `demo-studio-${purpose}`,
      correlationId: `demo-studio-${purpose}`,
      aggregateId: configuration.workspaceId,
      aggregateType: "WorkspaceStudioConfiguration",
      version: configuration.revision,
      occurredAt: configuration.updatedAt,
      outcome: "COMMITTED",
      warnings: [],
      emittedEventIds: [],
      auditEvidenceIds: [],
      configuration,
    };
    this.configurationListeners.forEach((listener) => listener(structuredClone(configuration)));
    return result;
  }

  private syntheticQuickSetupMutation(purpose: string, state: QuickSetupState): StudioQuickSetupMutationResult {
    return {
      commandId: `demo-quick-${purpose}`,
      correlationId: `demo-quick-${purpose}`,
      aggregateId: getActiveWorkspaceId() ?? "demo-workspace",
      aggregateType: "StudioQuickSetup",
      version: state.revision,
      occurredAt: new Date().toISOString(),
      outcome: "COMMITTED",
      auditEvidenceIds: [],
      state: structuredClone(state),
    };
  }
}

const demoRuntime = new DemoStudioCoreRuntime();
let runtime: StudioCoreRuntime = demoRuntime;
registerWorkspaceScopeDisposer(() => runtime.clear());

export function configureConnectedStudioCoreGateway(gateway: StudioCoreGateway): void {
  runtime.clear();
  runtime = new ConnectedStudioCoreRuntime(gateway);
}

export function resetStudioCoreRuntime(): void {
  runtime.clear();
  runtime = demoRuntime;
}

export const isConnectedStudioCoreRuntime = (): boolean => runtime.mode === "connected";
export const loadStudioCoreRuntime = async (signal?: AbortSignal): Promise<void> => {
  await Promise.all([runtime.loadConfiguration(signal), runtime.loadQuickSetup(signal)]);
};
export const getStudioCoreConfiguration = (): StudioCoreConfiguration => runtime.getConfiguration();
export const subscribeToStudioCoreConfiguration = (listener: (configuration: StudioCoreConfiguration) => void) => runtime.subscribeConfiguration(listener);
export const updateStudioBusinessInformation = (businessInformation: WorkspaceBusinessInformation, addresses: BusinessAddress[], options?: StudioCommandOptions) => runtime.updateBusinessInformation(businessInformation, addresses, options);
export const updateStudioLocaleRegion = (localeRegion: WorkspaceLocaleRegionConfiguration, options?: StudioCommandOptions) => runtime.updateLocaleRegion(localeRegion, options);
export const updateStudioBlueprint = (blueprint: Pick<CrmWorkspaceConfig, "businessModel" | "workflow">, features: CrmModuleVisibilityConfig, options?: StudioCommandOptions) => runtime.updateBlueprint(blueprint, features, options);
export const updateStudioFeatures = (features: CrmModuleVisibilityConfig, options?: StudioCommandOptions) => runtime.updateFeatures(features, options);
export const publishStudioConfiguration = (note?: string, options?: StudioCommandOptions) => runtime.publish(note, options);
export const listStudioConfigurationAudit = (signal?: AbortSignal) => runtime.listAudit(signal);
export const getStudioQuickSetupState = (): QuickSetupState => runtime.getQuickSetup();
export const subscribeToStudioQuickSetup = (listener: (state: QuickSetupState) => void) => runtime.subscribeQuickSetup(listener);
export const loadStudioQuickSetup = (signal?: AbortSignal) => runtime.loadQuickSetup(signal);
export const openStudioQuickSetupState = (options?: StudioCommandOptions) => runtime.openQuickSetup(options);
export const dismissStudioQuickSetupState = (options?: StudioCommandOptions) => runtime.dismissQuickSetupAutoOpen(options);
export const completeStudioQuickSetupStateStep = (stepId: QuickSetupStepId, options?: StudioCommandOptions) => runtime.completeQuickSetupStep(stepId, options);
export const skipStudioQuickSetupStateStep = (stepId: QuickSetupStepId, options?: StudioCommandOptions) => runtime.skipQuickSetupStep(stepId, options);

function createIdempotencyKey(prefix: string): string {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
