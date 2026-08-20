import { DEFAULT_CRM_WORKSPACE_CONFIG } from "./workspaceConfigDefaults";
import type { CrmWorkspaceConfig, CustomerCareModuleConfig, CustomerCarePriorityKey, ProductStrategyConfig } from "./workspaceConfig.types";

export function getProductStrategy(config: CrmWorkspaceConfig): ProductStrategyConfig {
  return {
    ...DEFAULT_CRM_WORKSPACE_CONFIG.moduleSettings!.products!,
    ...(config.moduleSettings?.products || {}),
  };
}

export function getCustomerCarePolicy(config: CrmWorkspaceConfig): CustomerCareModuleConfig {
  const defaults = DEFAULT_CRM_WORKSPACE_CONFIG.moduleSettings!.support!;
  const current = config.moduleSettings?.support;
  return {
    ...defaults,
    ...(current || {}),
    categoryLabels: {
      ...(defaults.categoryLabels || {}),
      ...(current?.categoryLabels || {}),
    },
    sourceLabels: {
      ...(defaults.sourceLabels || {}),
      ...(current?.sourceLabels || {}),
    },
    proactiveFollowUp: {
      ...defaults.proactiveFollowUp,
      ...(current?.proactiveFollowUp || {}),
    },
    commitments: {
      ...defaults.commitments,
      ...(current?.commitments || {}),
      firstResponseHours: {
        ...defaults.commitments.firstResponseHours,
        ...(current?.commitments.firstResponseHours || {}),
      },
      resolutionHours: {
        ...defaults.commitments.resolutionHours,
        ...(current?.commitments.resolutionHours || {}),
      },
    },
  };
}

export function calculateCareCommitmentDueDates(
  policy: CustomerCareModuleConfig,
  priority: CustomerCarePriorityKey,
  now = new Date(),
): { firstResponseDueAt?: string; resolutionDueAt?: string } {
  if (!policy.commitments.enabled) return {};
  const firstResponseHours = Math.max(0, policy.commitments.firstResponseHours[priority] ?? 0);
  const resolutionHours = Math.max(0, policy.commitments.resolutionHours[priority] ?? 0);
  return {
    firstResponseDueAt: new Date(now.getTime() + firstResponseHours * 60 * 60 * 1000).toISOString(),
    resolutionDueAt: new Date(now.getTime() + resolutionHours * 60 * 60 * 1000).toISOString(),
  };
}

export function calculateProactiveCareFollowUpAt(
  policy: CustomerCareModuleConfig,
  now = new Date(),
): string | undefined {
  if (!policy.proactiveFollowUp.enabled) return undefined;
  const delayDays = Math.max(0, policy.proactiveFollowUp.postPurchaseDelayDays || 0);
  return new Date(now.getTime() + delayDays * 24 * 60 * 60 * 1000).toISOString();
}

export function getCustomerCareCategoryLabel(
  policy: CustomerCareModuleConfig,
  key: string,
  locale: "vi" | "en",
): string | undefined {
  return policy.categoryLabels?.[key as keyof NonNullable<CustomerCareModuleConfig["categoryLabels"]>]?.[locale];
}

export function getCustomerCareSourceLabel(
  policy: CustomerCareModuleConfig,
  key: string,
  locale: "vi" | "en",
): string | undefined {
  return policy.sourceLabels?.[key as keyof NonNullable<CustomerCareModuleConfig["sourceLabels"]>]?.[locale];
}
