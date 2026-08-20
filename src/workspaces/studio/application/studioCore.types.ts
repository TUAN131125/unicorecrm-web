import type {
  BusinessAddress,
  CrmModuleVisibilityConfig,
  CrmWorkspaceConfig,
  WorkspaceBusinessInformation,
  WorkspaceLocaleRegionConfiguration,
  WorkspaceOperationalConfiguration,
} from "@/platform/workspace-config";
import type { QuickSetupState, QuickSetupStepId } from "./quickSetup.types";

export type StudioConfigurationPublicationStatus = "DRAFT" | "PUBLISHED";

export interface StudioCoreConfiguration {
  workspaceId: string;
  revision: number;
  publicationStatus: StudioConfigurationPublicationStatus;
  publishedRevision?: number;
  businessInformation: WorkspaceBusinessInformation;
  addresses: BusinessAddress[];
  localeRegion: WorkspaceLocaleRegionConfiguration;
  blueprint: Pick<CrmWorkspaceConfig, "businessModel" | "workflow">;
  features: CrmModuleVisibilityConfig;
  updatedAt: string;
  updatedByMemberId?: string;
}

export interface StudioConfigurationMutationResult {
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED";
  warnings: string[];
  emittedEventIds: string[];
  auditEvidenceIds: string[];
  configuration: StudioCoreConfiguration;
}

export interface StudioQuickSetupMutationResult {
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED";
  auditEvidenceIds: string[];
  state: QuickSetupState;
}

export interface StudioConfigurationAuditEntry {
  auditId: string;
  workspaceId: string;
  revision: number;
  action:
    | "BUSINESS_INFORMATION_UPDATED"
    | "LOCALE_REGION_UPDATED"
    | "BLUEPRINT_UPDATED"
    | "FEATURE_USAGE_UPDATED"
    | "CONFIGURATION_PUBLISHED"
    | "QUICK_SETUP_OPENED"
    | "QUICK_SETUP_DISMISSED"
    | "QUICK_SETUP_STEP_COMPLETED"
    | "QUICK_SETUP_STEP_SKIPPED";
  actorMemberId: string;
  occurredAt: string;
  correlationId: string;
  summary?: string;
}

export interface StudioCommandOptions {
  idempotencyKey: string;
  expectedVersion: number;
  signal?: AbortSignal;
}

export interface StudioCoreRuntime {
  readonly mode: "connected" | "demo";
  loadConfiguration(signal?: AbortSignal): Promise<StudioCoreConfiguration>;
  getConfiguration(): StudioCoreConfiguration;
  subscribeConfiguration(listener: (configuration: StudioCoreConfiguration) => void): () => void;
  updateBusinessInformation(
    businessInformation: WorkspaceBusinessInformation,
    addresses: BusinessAddress[],
    options?: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult>;
  updateLocaleRegion(
    localeRegion: WorkspaceLocaleRegionConfiguration,
    options?: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult>;
  updateBlueprint(
    blueprint: Pick<CrmWorkspaceConfig, "businessModel" | "workflow">,
    features: CrmModuleVisibilityConfig,
    options?: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult>;
  updateFeatures(
    features: CrmModuleVisibilityConfig,
    options?: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult>;
  publish(note: string | undefined, options?: StudioCommandOptions): Promise<StudioConfigurationMutationResult>;
  listAudit(signal?: AbortSignal): Promise<StudioConfigurationAuditEntry[]>;
  loadQuickSetup(signal?: AbortSignal): Promise<QuickSetupState>;
  getQuickSetup(): QuickSetupState;
  subscribeQuickSetup(listener: (state: QuickSetupState) => void): () => void;
  openQuickSetup(options?: StudioCommandOptions): Promise<StudioQuickSetupMutationResult>;
  dismissQuickSetupAutoOpen(options?: StudioCommandOptions): Promise<StudioQuickSetupMutationResult>;
  completeQuickSetupStep(stepId: QuickSetupStepId, options?: StudioCommandOptions): Promise<StudioQuickSetupMutationResult>;
  skipQuickSetupStep(stepId: QuickSetupStepId, options?: StudioCommandOptions): Promise<StudioQuickSetupMutationResult>;
  clear(): void;
}

export function toOperationalConfiguration(value: StudioCoreConfiguration): WorkspaceOperationalConfiguration {
  return {
    revision: value.revision,
    businessInformation: structuredClone(value.businessInformation),
    addresses: structuredClone(value.addresses),
    localeRegion: structuredClone(value.localeRegion),
    updatedAt: value.updatedAt,
  };
}
