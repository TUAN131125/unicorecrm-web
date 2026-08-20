import type { CrmTerminologyConfig, CrmWorkspaceConfig } from "./workspaceConfig.types";

type TranslationResolver = (i18nKey: string, params?: any) => string;

export function getTerminologyLabel(
  crmConfig: CrmWorkspaceConfig | undefined,
  key: keyof CrmTerminologyConfig,
  t: TranslationResolver,
): string {
  const configuredLabel = crmConfig?.terminology?.[key];
  if (configuredLabel) return configuredLabel;
  const baseKey = key.replace("Label", "");
  return t(`terminology.${baseKey}`);
}

export function getQuoteDocumentLabel(
  crmConfig: CrmWorkspaceConfig | undefined,
  t: TranslationResolver,
): string {
  const mode = crmConfig?.workflow?.quoteUsageMode;
  if (!mode || mode === "DISABLED") return t("common.notAvailable");
  if (mode === "QUOTE") return crmConfig?.terminology?.quoteLabel || t("terminology.quote");
  if (mode === "OFFER") return crmConfig?.terminology?.offerLabel || t("terminology.offer");
  if (mode === "PROPOSAL") return crmConfig?.terminology?.proposalLabel || t("terminology.proposal");
  return "";
}
