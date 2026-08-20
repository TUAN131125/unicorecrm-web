import { DEFAULT_CRM_WORKSPACE_CONFIG } from "./workspaceConfigDefaults";
import type { StoragePort } from "@/platform/persistence";
import type { CrmWorkspaceConfig } from "./workspaceConfig.types";

import type { WorkspaceConfigListener, WorkspaceConfigRepository } from "./WorkspaceConfigRepository";


type WorkspaceModuleSettings = NonNullable<CrmWorkspaceConfig["moduleSettings"]>;
type CompleteWorkspaceModuleSettings = Omit<{
  [Key in keyof WorkspaceModuleSettings]-?: NonNullable<WorkspaceModuleSettings[Key]>;
}, "quotes"> & {
  quotes: NonNullable<WorkspaceModuleSettings["quotes"]> & {
    approval: NonNullable<NonNullable<WorkspaceModuleSettings["quotes"]>["approval"]>;
  };
};

function getDefaultModuleSettings(): CompleteWorkspaceModuleSettings {
  const settings = DEFAULT_CRM_WORKSPACE_CONFIG.moduleSettings;
  if (!settings?.leads || !settings.opportunities || !settings.quotes?.approval || !settings.products || !settings.support) {
    throw new Error("Default CRM workspace module settings are incomplete.");
  }
  return {
    leads: settings.leads,
    opportunities: settings.opportunities,
    quotes: { ...settings.quotes, approval: settings.quotes.approval },
    products: settings.products,
    support: settings.support,
  };
}

interface StoredAdminSystemConfig {
  workspaceName?: string;
  enabledModules?: Partial<CrmWorkspaceConfig["modules"]>;
  terminology?: Partial<CrmWorkspaceConfig["terminology"]>;
  workflow?: Partial<CrmWorkspaceConfig["workflow"]>;
  businessModel?: CrmWorkspaceConfig["businessModel"];
  moduleSettings?: CrmWorkspaceConfig["moduleSettings"];
  [key: string]: unknown;
}

export class BrowserWorkspaceConfigRepository implements WorkspaceConfigRepository {
  private readonly listeners = new Set<WorkspaceConfigListener>();
  private current: CrmWorkspaceConfig;

  constructor(
    private readonly storage: StoragePort,
    private readonly storageKey = "centrix_admin_system_config_v1",
  ) {
    this.current = this.load();
  }

  getSnapshot(): CrmWorkspaceConfig {
    return this.current;
  }

  replace(config: CrmWorkspaceConfig): void {
    this.current = config;
    this.persist(config);
    this.emit();
  }

  update(updater: (current: CrmWorkspaceConfig) => CrmWorkspaceConfig): void {
    this.replace(updater(this.current));
  }

  reset(): void {
    this.storage.remove(this.storageKey);
    this.current = DEFAULT_CRM_WORKSPACE_CONFIG;
    this.emit();
  }

  subscribe(listener: WorkspaceConfigListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private load(): CrmWorkspaceConfig {
    const stored = this.storage.get<StoredAdminSystemConfig>(this.storageKey);
    if (!stored) return DEFAULT_CRM_WORKSPACE_CONFIG;

    const businessModel = stored.businessModel || DEFAULT_CRM_WORKSPACE_CONFIG.businessModel;
    const defaultModuleSettings = getDefaultModuleSettings();
    const modules = migrateStoredModules(stored.enabledModules, businessModel);
    if (needsStoredModuleMigration(stored.enabledModules, businessModel)) {
      this.storage.set(this.storageKey, { ...stored, businessModel, enabledModules: modules });
    }

    return {
      ...DEFAULT_CRM_WORKSPACE_CONFIG,
      name: stored.workspaceName || DEFAULT_CRM_WORKSPACE_CONFIG.name,
      businessModel,
      workflow: {
        ...DEFAULT_CRM_WORKSPACE_CONFIG.workflow,
        ...(stored.workflow || {}),
        dealUsageMode: String(stored.workflow?.dealUsageMode ?? "") === "REQUIRED"
          ? "OPTIONAL"
          : (stored.workflow?.dealUsageMode || DEFAULT_CRM_WORKSPACE_CONFIG.workflow.dealUsageMode),
      },
      modules,
      terminology: {
        ...DEFAULT_CRM_WORKSPACE_CONFIG.terminology,
        ...(stored.terminology || {}),
      },
      moduleSettings: {
        ...DEFAULT_CRM_WORKSPACE_CONFIG.moduleSettings,
        ...(stored.moduleSettings || {}),
        leads: {
          ...defaultModuleSettings.leads,
          ...(stored.moduleSettings?.leads || {}),
        },
        opportunities: {
          ...defaultModuleSettings.opportunities,
          ...(stored.moduleSettings?.opportunities || {}),
        },
        quotes: {
          ...defaultModuleSettings.quotes,
          ...(stored.moduleSettings?.quotes || {}),
          approval: {
            ...defaultModuleSettings.quotes.approval,
            ...(stored.moduleSettings?.quotes?.approval || {}),
          },
        },
        products: {
          ...defaultModuleSettings.products,
          ...(stored.moduleSettings?.products || {}),
        },
        support: {
          ...defaultModuleSettings.support,
          ...(stored.moduleSettings?.support || {}),
          categoryLabels: {
            ...(defaultModuleSettings.support.categoryLabels || {}),
            ...(stored.moduleSettings?.support?.categoryLabels || {}),
          },
          sourceLabels: {
            ...(defaultModuleSettings.support.sourceLabels || {}),
            ...(stored.moduleSettings?.support?.sourceLabels || {}),
          },
          proactiveFollowUp: {
            ...defaultModuleSettings.support.proactiveFollowUp,
            ...(stored.moduleSettings?.support?.proactiveFollowUp || {}),
          },
          commitments: {
            ...defaultModuleSettings.support.commitments,
            ...(stored.moduleSettings?.support?.commitments || {}),
            firstResponseHours: {
              ...defaultModuleSettings.support.commitments.firstResponseHours,
              ...(stored.moduleSettings?.support?.commitments.firstResponseHours || {}),
            },
            resolutionHours: {
              ...defaultModuleSettings.support.commitments.resolutionHours,
              ...(stored.moduleSettings?.support?.commitments.resolutionHours || {}),
            },
          },
        },
      },
    };
  }

  private persist(config: CrmWorkspaceConfig): void {
    const currentStored = this.storage.get<StoredAdminSystemConfig>(this.storageKey) || {};
    this.storage.set(this.storageKey, {
      ...currentStored,
      workspaceName: config.name,
      businessModel: config.businessModel,
      workflow: config.workflow,
      enabledModules: config.modules,
      terminology: config.terminology,
      moduleSettings: config.moduleSettings,
    });
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener(this.current));
  }
}

type StoredModuleVisibility = Partial<CrmWorkspaceConfig["modules"]> & { customerView?: boolean };

function migrateStoredModules(
  stored: StoredModuleVisibility | undefined,
  businessModel: CrmWorkspaceConfig["businessModel"],
): CrmWorkspaceConfig["modules"] {
  const { customerView: _legacyCustomerView, ...current } = stored ?? {};
  return {
    ...DEFAULT_CRM_WORKSPACE_CONFIG.modules,
    ...current,
    customers: true,
    // Organization is a canonical CRM module for every B2B/Hybrid workspace.
    // Preserve the intentional B2C-only hiding rule, but repair stale B2B snapshots
    // that lost the module while old workspace presets were being migrated.
    organizations: businessModel === "B2C" ? (current.organizations ?? false) : true,
  };
}

function needsStoredModuleMigration(
  stored: StoredModuleVisibility | undefined,
  businessModel: CrmWorkspaceConfig["businessModel"],
): boolean {
  return stored?.customers !== true
    || (businessModel !== "B2C" && stored?.organizations !== true)
    || Object.prototype.hasOwnProperty.call(stored ?? {}, "customerView");
}
