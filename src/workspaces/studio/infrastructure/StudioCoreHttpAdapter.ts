import {
  StudioQuickSetupApiClient,
  type StudioQuickSetupMutationResponse,
  type StudioQuickSetupStateDocument,
  type StudioQuickSetupStepId,
} from "@/platform/api/generated/studioQuickSetupApi";
import {
  WorkspaceConfigurationApiClient,
  type StudioConfigurationAuditEntryDocument,
  type StudioConfigurationMutationResponse,
  type StudioCoreConfigurationDocument,
  type WorkspaceExchangeRateDocument,
  type WorkspaceFeatureUsageDocument,
  type WorkspaceLocaleRegionDocument,
} from "@/platform/api/generated/workspaceConfigurationApi";
import type {
  BusinessAddress,
  CrmModuleVisibilityConfig,
  CrmWorkspaceConfig,
  ExchangeRate,
  WorkspaceBusinessInformation,
  WorkspaceLocaleRegionConfiguration,
} from "@/platform/workspace-config";
import type { StudioCoreGateway } from "../application/StudioCoreGateway";
import type { QuickSetupState, QuickSetupStepId } from "../application/quickSetup.types";
import type {
  StudioCommandOptions,
  StudioConfigurationAuditEntry,
  StudioConfigurationMutationResult,
  StudioCoreConfiguration,
  StudioQuickSetupMutationResult,
} from "../application/studioCore.types";

export class StudioCoreHttpAdapter implements StudioCoreGateway {
  constructor(
    private readonly workspaceApi: WorkspaceConfigurationApiClient,
    private readonly quickSetupApi: StudioQuickSetupApiClient,
  ) {}

  async getConfiguration(signal?: AbortSignal): Promise<StudioCoreConfiguration> {
    return mapConfiguration(await this.workspaceApi.getWorkspaceConfiguration({}, signal));
  }

  async updateBusinessInformation(
    businessInformation: WorkspaceBusinessInformation,
    addresses: BusinessAddress[],
    options: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult> {
    const response = await this.workspaceApi.updateWorkspaceBusinessInformation(
      { businessInformation: structuredClone(businessInformation), addresses: structuredClone(addresses) },
      toRequestOptions(options),
    );
    return mapConfigurationMutation(response);
  }

  async updateLocaleRegion(
    localeRegion: WorkspaceLocaleRegionConfiguration,
    options: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult> {
    const response = await this.workspaceApi.updateWorkspaceLocaleRegion(
      { localeRegion: toLocaleRegionDocument(localeRegion) },
      toRequestOptions(options),
    );
    return mapConfigurationMutation(response);
  }

  async updateBlueprint(
    blueprint: Pick<CrmWorkspaceConfig, "businessModel" | "workflow">,
    features: CrmModuleVisibilityConfig,
    options: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult> {
    const response = await this.workspaceApi.updateWorkspaceBlueprint(
      { blueprint: structuredClone(blueprint), features: toFeatureDocument(features) },
      toRequestOptions(options),
    );
    return mapConfigurationMutation(response);
  }

  async updateFeatures(
    features: CrmModuleVisibilityConfig,
    options: StudioCommandOptions,
  ): Promise<StudioConfigurationMutationResult> {
    const response = await this.workspaceApi.updateWorkspaceFeatures(
      { features: toFeatureDocument(features) },
      toRequestOptions(options),
    );
    return mapConfigurationMutation(response);
  }

  async publish(note: string | undefined, options: StudioCommandOptions): Promise<StudioConfigurationMutationResult> {
    const response = await this.workspaceApi.publishWorkspaceConfiguration(
      note?.trim() ? { note: note.trim() } : {},
      toRequestOptions(options),
    );
    return mapConfigurationMutation(response);
  }

  async listAudit(signal?: AbortSignal): Promise<StudioConfigurationAuditEntry[]> {
    const response = await this.workspaceApi.listWorkspaceConfigurationAudit({}, signal);
    return response.items.map(mapAuditEntry);
  }

  async getQuickSetup(signal?: AbortSignal): Promise<QuickSetupState> {
    return mapQuickSetupState(await this.quickSetupApi.getStudioQuickSetup({}, signal));
  }

  async openQuickSetup(options: StudioCommandOptions): Promise<StudioQuickSetupMutationResult> {
    return mapQuickSetupMutation(await this.quickSetupApi.openStudioQuickSetup({}, toQuickSetupOptions(options)));
  }

  async dismissQuickSetupAutoOpen(options: StudioCommandOptions): Promise<StudioQuickSetupMutationResult> {
    return mapQuickSetupMutation(await this.quickSetupApi.dismissStudioQuickSetupAutoOpen({}, toQuickSetupOptions(options)));
  }

  async completeQuickSetupStep(stepId: QuickSetupStepId, options: StudioCommandOptions): Promise<StudioQuickSetupMutationResult> {
    return mapQuickSetupMutation(await this.quickSetupApi.completeStudioQuickSetupStep(stepId as StudioQuickSetupStepId, {}, toQuickSetupOptions(options)));
  }

  async skipQuickSetupStep(stepId: QuickSetupStepId, options: StudioCommandOptions): Promise<StudioQuickSetupMutationResult> {
    return mapQuickSetupMutation(await this.quickSetupApi.skipStudioQuickSetupStep(stepId as StudioQuickSetupStepId, {}, toQuickSetupOptions(options)));
  }
}

function toRequestOptions(options: StudioCommandOptions) {
  return {
    idempotencyKey: options.idempotencyKey,
    expectedVersion: options.expectedVersion,
    ...(options.signal ? { signal: options.signal } : {}),
    retry: "never" as const,
  };
}

function toQuickSetupOptions(options: StudioCommandOptions) {
  return {
    idempotencyKey: options.idempotencyKey,
    expectedVersion: options.expectedVersion,
    ...(options.signal ? { signal: options.signal } : {}),
    retry: "never" as const,
  };
}

function mapConfiguration(value: StudioCoreConfigurationDocument): StudioCoreConfiguration {
  return {
    workspaceId: value.workspaceId,
    revision: value.revision,
    publicationStatus: value.publicationStatus,
    ...(value.publishedRevision === undefined ? {} : { publishedRevision: value.publishedRevision }),
    businessInformation: { ...value.businessInformation },
    addresses: value.addresses.map((item) => ({ ...item, purposes: [...item.purposes] })),
    localeRegion: mapLocaleRegion(value.localeRegion),
    blueprint: { businessModel: value.blueprint.businessModel, workflow: { ...value.blueprint.workflow } },
    features: { ...value.features },
    updatedAt: value.updatedAt,
    ...(value.updatedByMemberId ? { updatedByMemberId: value.updatedByMemberId } : {}),
  };
}

function mapLocaleRegion(value: WorkspaceLocaleRegionDocument): WorkspaceLocaleRegionConfiguration {
  return {
    supportedLocales: [...value.supportedLocales],
    defaultLocale: value.defaultLocale,
    timezone: value.timezone,
    countryCode: value.countryCode,
    dateFormat: value.dateFormat,
    weekStartsOn: value.weekStartsOn,
    currencies: {
      baseCurrency: value.currencies.baseCurrency,
      enabledCurrencies: [...value.currencies.enabledCurrencies],
      displayMode: value.currencies.displayMode,
      exchangeRateMode: value.currencies.exchangeRateMode,
      exchangeRateProviderConnectionId: asNullableString(value.currencies.exchangeRateProviderConnectionId),
    },
    exchangeRates: value.exchangeRates.map(mapExchangeRate),
  };
}

function mapExchangeRate(value: WorkspaceExchangeRateDocument): ExchangeRate {
  return {
    id: value.id,
    fromCurrency: value.fromCurrency,
    toCurrency: value.toCurrency,
    rate: value.rate,
    effectiveAt: value.effectiveAt,
    source: value.source,
    providerConnectionId: asNullableString(value.providerConnectionId),
    status: value.status,
    version: value.version,
  };
}

function toLocaleRegionDocument(value: WorkspaceLocaleRegionConfiguration): WorkspaceLocaleRegionDocument {
  return {
    supportedLocales: [...value.supportedLocales],
    defaultLocale: value.defaultLocale,
    timezone: value.timezone,
    countryCode: value.countryCode,
    dateFormat: value.dateFormat,
    weekStartsOn: value.weekStartsOn,
    currencies: {
      baseCurrency: value.currencies.baseCurrency,
      enabledCurrencies: [...value.currencies.enabledCurrencies],
      displayMode: value.currencies.displayMode,
      exchangeRateMode: value.currencies.exchangeRateMode,
      exchangeRateProviderConnectionId: value.currencies.exchangeRateProviderConnectionId,
    },
    exchangeRates: value.exchangeRates.map((item) => ({
      id: item.id,
      fromCurrency: item.fromCurrency,
      toCurrency: item.toCurrency,
      rate: item.rate,
      effectiveAt: item.effectiveAt,
      source: item.source,
      providerConnectionId: item.providerConnectionId,
      status: item.status,
      version: item.version,
    })),
  };
}

function toFeatureDocument(value: CrmModuleVisibilityConfig): WorkspaceFeatureUsageDocument {
  return {
    leads: value.leads,
    customers: true,
    contacts: value.contacts,
    deals: value.deals,
    quotes: value.quotes,
    orders: value.orders,
    support: value.support,
    organizations: value.organizations !== false,
    tasks: value.tasks !== false,
    payments: value.payments !== false,
    invoices: value.invoices !== false,
    shipping: value.shipping !== false,
    returns: value.returns !== false,
  };
}

function mapConfigurationMutation(value: StudioConfigurationMutationResponse): StudioConfigurationMutationResult {
  return {
    commandId: value.commandId,
    correlationId: value.correlationId,
    aggregateId: value.aggregateId,
    aggregateType: value.aggregateType,
    version: value.version,
    occurredAt: value.occurredAt,
    outcome: value.outcome,
    warnings: [...(value.warnings ?? [])],
    emittedEventIds: [...(value.emittedEventIds ?? [])],
    auditEvidenceIds: [...(value.auditEvidenceIds ?? [])],
    configuration: mapConfiguration(value.result),
  };
}

function mapAuditEntry(value: StudioConfigurationAuditEntryDocument): StudioConfigurationAuditEntry {
  return {
    auditId: value.auditId,
    workspaceId: value.workspaceId,
    revision: value.revision,
    action: value.action,
    actorMemberId: value.actorMemberId,
    occurredAt: value.occurredAt,
    correlationId: value.correlationId,
    ...(value.summary ? { summary: value.summary } : {}),
  };
}

function mapQuickSetupMutation(value: StudioQuickSetupMutationResponse): StudioQuickSetupMutationResult {
  return {
    commandId: value.commandId,
    correlationId: value.correlationId,
    aggregateId: value.aggregateId,
    aggregateType: value.aggregateType,
    version: value.version,
    occurredAt: value.occurredAt,
    outcome: value.outcome,
    auditEvidenceIds: [...(value.auditEvidenceIds ?? [])],
    state: mapQuickSetupState(value.result),
  };
}

function mapQuickSetupState(value: StudioQuickSetupStateDocument): QuickSetupState {
  return {
    status: value.status,
    currentStepId: isQuickSetupStepId(value.currentStepId) ? value.currentStepId : null,
    completedStepIds: value.completedStepIds.filter(isQuickSetupStepId),
    skippedStepIds: value.skippedStepIds.filter(isQuickSetupStepId),
    autoOpenDismissedAt: asNullableString(value.autoOpenDismissedAt),
    lastOpenedAt: asNullableString(value.lastOpenedAt),
    completedAt: asNullableString(value.completedAt),
    revision: value.revision,
    flowVersion: value.flowVersion,
  };
}

function isQuickSetupStepId(value: unknown): value is QuickSetupStepId {
  return value === "business-profile" || value === "locale-currency" || value === "workspace-blueprint";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
