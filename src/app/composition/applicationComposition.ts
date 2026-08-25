import { configureCommercialEvidenceApplication } from "@/modules/commercial-evidence/application/composition/commercialEvidenceApplicationServices";
import { configureContactApplication } from "@/modules/contacts/application/composition/contactApplicationServices";
import { configureCustomerApplication } from "@/modules/customers/application/composition/customerApplicationServices";
import { configureDealApplication } from "@/modules/deals/application/composition/dealApplicationServices";
import { configureInvoiceApplication } from "@/modules/invoices/application/composition/invoiceApplicationServices";
import { configureLeadApplication } from "@/modules/leads/application/composition/leadApplicationServices";
import { createLeadModuleDataAuthorityBridge } from "@/modules/leads/infrastructure/http/LeadModuleDataAuthorityBridge";
import { configureOrderApplication } from "@/modules/orders/application/composition/orderApplicationServices";
import { createOrderModuleDataAuthorityBridge } from "@/modules/orders/infrastructure/http/OrderModuleDataAuthorityBridge";
import { configureOrganizationApplication } from "@/modules/organizations/application/composition/organizationApplicationServices";
import { configurePaymentApplication } from "@/modules/payments/application/composition/paymentApplicationServices";
import { configureProductApplication } from "@/modules/products/application/composition/productApplicationServices";
import { createProductModuleDataAuthorityBridge } from "@/modules/products/infrastructure/http/ProductModuleDataAuthorityBridge";
import { configureQuoteApplication } from "@/modules/quotes/application/composition/quoteApplicationServices";
import { configureReturnApplication } from "@/modules/returns/application/composition/returnApplicationServices";
import { configureShippingApplication } from "@/modules/shipping/application/composition/shippingApplicationServices";
import { configureSupportApplication } from "@/modules/support/application/composition/supportApplicationServices";
import { configureTaskApplication } from "@/modules/tasks/application/composition/taskApplicationServices";
import {
  configureAuditTrailAuthority,
  resetAuditTrailAuthority,
} from "@/platform/audit/application/auditTrailBinding";
import { HttpAuditTrailAuthority } from "@/platform/audit/infrastructure/HttpAuditTrailAuthority";
import {
  configureExternalAuthorityHealthAuthority,
  resetExternalAuthorityHealthAuthority,
} from "@/platform/external-authority/application/externalAuthorityHealthBinding";
import { HttpExternalAuthorityHealthAuthority } from "@/platform/external-authority/infrastructure/HttpExternalAuthorityHealthAuthority";
import {
  configureEffectiveRecordAccessAuthority,
  resetEffectiveRecordAccessAuthority,
} from "@/platform/access-control/application/effectiveRecordAccessBinding";
import { HttpEffectiveRecordAccessAuthority } from "@/platform/access-control/infrastructure/HttpEffectiveRecordAccessAuthority";
import { AccessGovernanceApiClient } from "@/platform/api/generated/accessGovernanceApi";
import { AccessGovernanceHttpAdapter } from "@/platform/access-control/infrastructure/AccessGovernanceHttpAdapter";
import { WorkspaceConfigurationApiClient } from "@/platform/api/generated/workspaceConfigurationApi";
import { StudioQuickSetupApiClient } from "@/platform/api/generated/studioQuickSetupApi";
import { StudioCoreHttpAdapter } from "@/workspaces/studio/infrastructure/StudioCoreHttpAdapter";
import { configureConnectedStudioCoreGateway, resetStudioCoreRuntime } from "@/workspaces/studio/runtime/studioCoreRuntime";
import { configureConnectedAiRuntime, resetAiRuntime } from "@/ai/runtime/aiRuntimeBinding";
import {
  configureDefaultAccessGovernanceRuntime,
  loadAccessGovernance,
} from "@/platform/access-control/runtime/accessGovernanceRuntime";
import {
  configureWorkspaceRuntimeParticipant,
  resetWorkspaceRuntimeParticipant,
} from "@/platform/workspace-context";
import { createPeopleAccessDemoRuntime } from "@/workspaces/people-access/runtime/createPeopleAccessDemoRuntime";
import {
  configureModuleDataAuthorityRegistry,
  configureMutationAuthority,
  resetModuleDataAuthorityRegistry,
  type MutationAuthorityPort,
  resetBusinessOperationAvailability,
} from "@/shared/application";
import {
  createHttpModuleDataAuthorityRegistry,
  FetchHttpClient,
  RoutedHttpMutationAuthority,
  type AccessTokenProvider,
  type FetchHttpClientOptions,
  type HttpClient,
  type RoutedHttpMutationAuthorityOptions,
  type WorkspaceIdProvider,
} from "@/platform/api";
import { configureContactOpportunityApplication } from "@/workflows/contact-opportunity-creation/application/composition/contactOpportunityApplicationServices";
import { configureCustomerConversionApplication } from "@/workflows/customer-conversion/application/composition/customerConversionApplicationServices";
import { configureDealRecycleApplication } from "@/workflows/deal-recycle/application/composition/dealRecycleApplicationServices";
import { configureLeadQualificationApplication } from "@/workflows/lead-qualification/application/composition/leadQualificationApplicationServices";
import { configureLeadQualificationApiRuntime } from "@/workflows/lead-qualification/application/composition/leadQualificationApiRuntimeBinding";
import { createLeadQualificationConnectedApiRuntime } from "@/workflows/lead-qualification/infrastructure/http/createLeadQualificationConnectedApiRuntime";
import { createLeadQualificationDemoApiRuntime } from "@/workflows/lead-qualification/runtime/createLeadQualificationDemoApiRuntime";
import { configureOrderClosingApplication } from "@/workflows/order-closing/application/composition/orderClosingApplicationServices";
import { configurePilotAcceptanceApplication } from "@/workspaces/people-access/pilot-acceptance/application/composition/pilotAcceptanceApplicationServices";
import {
  createConnectedApplicationServiceBundle,
  type ConnectedApplicationRuntimeProviders,
} from "./connectedApplicationServiceBundle";
import type { ApplicationServiceBundle } from "./applicationServiceBundle";
import { createConfigurationApiClients, type ConfigurationApiClients } from "@/platform/api";
import { CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS } from "./connectedModuleQueryResponseMappers";
import { declareConnectedPlatformConfigurationUnavailability } from "./connected/connectedPlatformConfigurationServices";

export type ApplicationRuntimeMode = "demo" | "connected";

export interface ApplicationCompositionOverrides {
  mutationAuthority?: MutationAuthorityPort;
}

export interface ApplicationHttpConfiguration {
  client?: HttpClient;
  baseUrl?: string;
  accessTokenProvider?: AccessTokenProvider;
  workspaceIdProvider?: WorkspaceIdProvider;
  fetchImplementation?: FetchHttpClientOptions["fetchImplementation"];
  defaultTimeoutMs?: number;
  retryPolicy?: FetchHttpClientOptions["retryPolicy"];
  onUnauthorized?: () => Promise<boolean | void>;
  onMutationCommitted?: RoutedHttpMutationAuthorityOptions["onCommitted"];
  telemetry?: ConnectedApplicationRuntimeProviders["telemetry"];
}

export interface InitializeApplicationCompositionOptions {
  mode?: ApplicationRuntimeMode;
  services?: ApplicationServiceBundle;
  overrides?: ApplicationCompositionOverrides;
  http?: ApplicationHttpConfiguration;
}

export interface ApplicationCompositionStatus {
  mode: ApplicationRuntimeMode;
  serviceAuthority: "demo-browser" | "connected-http";
  mutationAuthority: "demo-local" | "connected-http" | "override";
  httpConfigured: boolean;
  moduleDataAuthority: "connected-http" | "demo-unavailable";
  effectiveRecordAccessAuthority: "connected-http" | "demo-local";
  externalAuthorityHealthAuthority: "connected-http" | "demo-local";
  auditTrailAuthority: "connected-http" | "demo-local";
  configurationAuthority: "generated-http" | "demo-browser";
}

let currentMode: ApplicationRuntimeMode | undefined;
let currentHttpClient: HttpClient | undefined;
let currentStatus: ApplicationCompositionStatus | undefined;
let currentConfigurationApiClients: ConfigurationApiClients | undefined;

export async function initializeApplicationComposition(
  options: InitializeApplicationCompositionOptions = {},
): Promise<ApplicationRuntimeMode> {
  const mode = options.mode ?? "demo";
  if (mode === "connected" && options.services) {
    throw new Error(
      "Connected application composition owns HTTP application services. Host-injected ApplicationServiceBundle values are not accepted.",
    );
  }
  // Availability declarations belong to the runtime being built, so the previous runtime's
  // declarations are cleared before the new composition registers its own.
  resetBusinessOperationAvailability();
  // Platform configuration singletons have no ports to bind, so the connected composition
  // declares their unavailability directly. Declared before the service bundle is built so
  // nothing constructed below can observe a half-populated availability registry.
  if (mode === "connected") declareConnectedPlatformConfigurationUnavailability();
  const connectedHttpClient = mode === "connected" ? resolveConnectedHttpClient(options.http) : undefined;
  const services = mode === "connected"
    ? createConnectedApplicationServiceBundle(connectedHttpClient as HttpClient, { telemetry: options.http?.telemetry })
    : options.services ?? (await import("./demoApplicationServiceBundle")).createDemoApplicationServiceBundle();
  const moduleDataAuthority = mode === "connected" && connectedHttpClient
    ? createHttpModuleDataAuthorityRegistry(connectedHttpClient, undefined, CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS)
    : undefined;
  if (moduleDataAuthority) {
    moduleDataAuthority.leads = createLeadModuleDataAuthorityBridge(services.modules.leads.api);
    moduleDataAuthority.products = createProductModuleDataAuthorityBridge(services.modules.products.api);
    moduleDataAuthority.orders = createOrderModuleDataAuthorityBridge(services.modules.orders.api);
  }
  let mutationAuthority = options.overrides?.mutationAuthority;
  if (!mutationAuthority) {
    if (mode === "connected") {
      if (!connectedHttpClient || !moduleDataAuthority) {
        throw new Error("Connected composition requires HTTP client and module data authority bindings.");
      }
      mutationAuthority = new RoutedHttpMutationAuthority(connectedHttpClient, moduleDataAuthority, {
        onCommitted: options.http?.onMutationCommitted,
      });
    } else {
      const { LocalMutationAuthority } = await import(
        "@/shared/application/mutation/LocalMutationAuthority"
      );
      mutationAuthority = new LocalMutationAuthority();
    }
  }

  configureApplicationServices(services);
  configureDefaultAccessGovernanceRuntime(mode === "connected"
    ? new AccessGovernanceHttpAdapter(new AccessGovernanceApiClient(connectedHttpClient as HttpClient))
    : createPeopleAccessDemoRuntime());
  // Canonical workspace entry resolves the AccessControl context before the frontend
  // commits a workspace. Registering it here keeps workspace-context free of an
  // access-control dependency while making the check unavoidable.
  if (mode === "connected") {
    configureWorkspaceRuntimeParticipant(async (workspaceId, signal) => {
      const state = await loadAccessGovernance(workspaceId, signal);
      if (signal?.aborted) return;
      if (!state.snapshot) throw new Error(state.error ?? "ACCESS_CONTEXT_UNAVAILABLE");
    });
  } else {
    resetWorkspaceRuntimeParticipant();
  }
  configureLeadQualificationApiRuntime(mode === "connected"
    ? createLeadQualificationConnectedApiRuntime(connectedHttpClient as HttpClient)
    : createLeadQualificationDemoApiRuntime());
  if (mode === "connected") {
    configureConnectedStudioCoreGateway(new StudioCoreHttpAdapter(
      new WorkspaceConfigurationApiClient(connectedHttpClient as HttpClient),
      new StudioQuickSetupApiClient(connectedHttpClient as HttpClient),
    ));
  } else {
    resetStudioCoreRuntime();
  }
  // AI is a cross-cutting CRM capability, not one of the 15 business modules.
  // Connected mode binds the HTTP-backed runtime; demo mode falls back to the
  // browser runtime. Connected mode never degrades to the demo AI runtime.
  if (mode === "connected") configureConnectedAiRuntime(connectedHttpClient as HttpClient);
  else resetAiRuntime();
  configureMutationAuthority(mutationAuthority);
  if (moduleDataAuthority) configureModuleDataAuthorityRegistry(moduleDataAuthority);
  else resetModuleDataAuthorityRegistry();
  if (mode === "connected" && connectedHttpClient) {
    configureEffectiveRecordAccessAuthority(new HttpEffectiveRecordAccessAuthority(connectedHttpClient));
    configureExternalAuthorityHealthAuthority(new HttpExternalAuthorityHealthAuthority(connectedHttpClient));
    configureAuditTrailAuthority(new HttpAuditTrailAuthority(connectedHttpClient));
  } else {
    resetEffectiveRecordAccessAuthority();
    resetExternalAuthorityHealthAuthority();
    resetAuditTrailAuthority();
  }

  currentMode = mode;
  currentHttpClient = connectedHttpClient;
  currentConfigurationApiClients = connectedHttpClient ? createConfigurationApiClients(connectedHttpClient) : undefined;
  currentStatus = {
    mode,
    serviceAuthority: mode === "connected" ? "connected-http" : "demo-browser",
    mutationAuthority: options.overrides?.mutationAuthority
      ? "override"
      : mode === "connected" ? "connected-http" : "demo-local",
    httpConfigured: connectedHttpClient !== undefined,
    moduleDataAuthority: mode === "connected" ? "connected-http" : "demo-unavailable",
    effectiveRecordAccessAuthority: mode === "connected" ? "connected-http" : "demo-local",
    externalAuthorityHealthAuthority: mode === "connected" ? "connected-http" : "demo-local",
    auditTrailAuthority: mode === "connected" ? "connected-http" : "demo-local",
    configurationAuthority: mode === "connected" ? "generated-http" : "demo-browser",
  };
  return mode;
}

export function getApplicationRuntimeMode(): ApplicationRuntimeMode {
  if (!currentMode) throw new Error("Application composition has not been initialized.");
  return currentMode;
}

export function getApplicationHttpClient(): HttpClient | undefined {
  if (!currentMode) throw new Error("Application composition has not been initialized.");
  return currentHttpClient;
}

export function getApplicationConfigurationApiClients(): ConfigurationApiClients {
  if (currentMode !== "connected" || !currentConfigurationApiClients) {
    throw new Error("Generated configuration API clients are available only in connected mode.");
  }
  return currentConfigurationApiClients;
}

export function getApplicationCompositionStatus(): ApplicationCompositionStatus {
  if (!currentStatus) throw new Error("Application composition has not been initialized.");
  return { ...currentStatus };
}

function configureApplicationServices(services: ApplicationServiceBundle): void {
  configureCommercialEvidenceApplication(services.modules.commercialEvidence);
  configureContactApplication(services.modules.contacts);
  configureCustomerApplication(services.modules.customers);
  configureDealApplication(services.modules.deals);
  configurePaymentApplication(services.modules.payments);
  configureInvoiceApplication(services.modules.invoices);
  configureLeadApplication(services.modules.leads);
  configureOrderApplication(services.modules.orders);
  configureOrganizationApplication(services.modules.organizations);
  configureProductApplication(services.modules.products);
  configureQuoteApplication(services.modules.quotes);
  configureReturnApplication(services.modules.returns);
  configureShippingApplication(services.modules.shipping);
  configureSupportApplication(services.modules.support);
  configureTaskApplication(services.modules.tasks);
  configureContactOpportunityApplication(services.workflows.contactOpportunityCreation);
  configureCustomerConversionApplication(services.workflows.customerConversion);
  configureDealRecycleApplication(services.workflows.dealRecycle);
  configureLeadQualificationApplication(services.workflows.leadQualification);
  configureOrderClosingApplication(services.workflows.orderClosing);
  configurePilotAcceptanceApplication(services.workspaces.pilotAcceptance);
}

function resolveConnectedHttpClient(configuration?: ApplicationHttpConfiguration): HttpClient {
  if (configuration?.client) return configuration.client;
  if (!configuration?.baseUrl) {
    throw new Error("Connected application composition requires an HTTP client or API base URL.");
  }
  if (!configuration.accessTokenProvider) {
    throw new Error("Connected application composition requires an accessTokenProvider. Auth session IDs are not bearer tokens.");
  }
  if (!configuration.workspaceIdProvider) {
    throw new Error("Connected application composition requires a workspaceIdProvider. Workspace authority must come from the host session binding.");
  }
  return new FetchHttpClient({
    baseUrl: configuration.baseUrl,
    accessTokenProvider: configuration.accessTokenProvider,
    workspaceIdProvider: configuration.workspaceIdProvider,
    fetchImplementation: configuration.fetchImplementation,
    defaultTimeoutMs: configuration.defaultTimeoutMs,
    retryPolicy: configuration.retryPolicy,
    onUnauthorized: configuration.onUnauthorized,
  });
}
