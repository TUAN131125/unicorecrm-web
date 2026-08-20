import type {
  BusinessAddress,
  CrmModuleVisibilityConfig,
  CrmWorkspaceConfig,
  WorkspaceBusinessInformation,
  WorkspaceLocaleRegionConfiguration,
} from "@/platform/workspace-config";
import type { QuickSetupStepId } from "./quickSetup.types";
import type {
  StudioCommandOptions,
  StudioConfigurationAuditEntry,
  StudioConfigurationMutationResult,
  StudioCoreConfiguration,
  StudioQuickSetupMutationResult,
} from "./studioCore.types";
import type { QuickSetupState } from "./quickSetup.types";

export interface StudioCoreGateway {
  getConfiguration(signal?: AbortSignal): Promise<StudioCoreConfiguration>;
  updateBusinessInformation(
    businessInformation: WorkspaceBusinessInformation,
    addresses: BusinessAddress[],
    options: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult>;
  updateLocaleRegion(
    localeRegion: WorkspaceLocaleRegionConfiguration,
    options: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult>;
  updateBlueprint(
    blueprint: Pick<CrmWorkspaceConfig, "businessModel" | "workflow">,
    features: CrmModuleVisibilityConfig,
    options: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult>;
  updateFeatures(
    features: CrmModuleVisibilityConfig,
    options: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult>;
  publish(note: string | undefined, options: StudioCommandOptions): Promise<StudioConfigurationMutationResult>;
  listAudit(signal?: AbortSignal): Promise<StudioConfigurationAuditEntry[]>;
  getQuickSetup(signal?: AbortSignal): Promise<QuickSetupState>;
  openQuickSetup(options: StudioCommandOptions): Promise<StudioQuickSetupMutationResult>;
  dismissQuickSetupAutoOpen(options: StudioCommandOptions): Promise<StudioQuickSetupMutationResult>;
  completeQuickSetupStep(stepId: QuickSetupStepId, options: StudioCommandOptions): Promise<StudioQuickSetupMutationResult>;
  skipQuickSetupStep(stepId: QuickSetupStepId, options: StudioCommandOptions): Promise<StudioQuickSetupMutationResult>;
}
