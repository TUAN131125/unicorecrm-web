import { createInvoiceVerticalSlice } from "@/modules/invoices/application/vertical-slice/invoiceVerticalSlice";
import { createPaymentVerticalSlice } from "@/modules/payments/application/vertical-slice/paymentVerticalSlice";
import { InMemoryReceivablesApiAdapter } from "@/modules/invoices/infrastructure/InMemoryReceivablesApiAdapter";
import { purchaseEvidenceRepository } from "@/modules/commercial-evidence/runtime/purchaseEvidenceModuleRuntime";
import { contactPreferences, contactRepository } from "@/modules/contacts/runtime/contactModuleRuntime";
import { createContactDemoApiRuntime } from "@/modules/contacts/runtime/createContactDemoApiRuntime";
import {
  customerRepository,
  ensureCustomerRepositoryReady,
  getCustomerMigrationProfileRuntime,
  reconcileCustomerRepositoryFromPurchaseEvidence,
} from "@/modules/customers/runtime/customerModuleRuntime";
import { createCustomerDemoApiRuntime } from "@/modules/customers/runtime/createCustomerDemoApiRuntime";
import { browserDealExporter } from "@/modules/deals/runtime/export/BrowserDealExporter";
import { dealRepository, dealStageRepository } from "@/modules/deals/runtime/dealModuleRuntime";
import { createDealDemoApiRuntime } from "@/modules/deals/runtime/createDealDemoApiRuntime";
import { invoiceApi, invoiceRepository } from "@/modules/invoices/runtime/invoiceModuleRuntime";
import { invoiceConfigurationRepository } from "@/modules/invoices/runtime/invoiceConfigurationRuntime";
import {
  getReceivableCollectionActivities,
  saveReceivableCollectionActivity,
  subscribeToReceivableCollectionActivities,
  updateReceivableCollectionActivityState,
} from "@/modules/invoices/runtime/receivableOperationsStore";
import { createLeadWebhookIngress } from "@/modules/leads/runtime/ingress/leadWebhookIngress";
import { leadExporter, leadPreferences, leadRepository } from "@/modules/leads/runtime/leadModuleRuntime";
import { createLeadDemoApiRuntime } from "@/modules/leads/runtime/createLeadDemoApiRuntime";
import { orderPreferences, orderRepository } from "@/modules/orders/runtime/orderModuleRuntime";
import { createOrderDemoApiRuntime } from "@/modules/orders/runtime/createOrderDemoApiRuntime";
import { organizationAccountRepository } from "@/modules/organizations/runtime/organizationAccountModuleRuntime";
import { createOrganizationDemoApiRuntime } from "@/modules/organizations/runtime/createOrganizationDemoApiRuntime";
import { paymentApi, paymentRepository } from "@/modules/payments/runtime/paymentModuleRuntime";
import { paymentConfigurationRepository } from "@/modules/payments/runtime/paymentConfigurationRuntime";
import {
  getConfiguredProductFieldsRuntime,
  getConfiguredProductTypesRuntime,
  getDefaultProductConfigurationRuntime,
  isConfiguredProductFieldUsedRuntime,
  isConfiguredProductTypeUsedRuntime,
  resetProductConfigurationRuntime,
  saveConfiguredProductFieldsRuntime,
  saveConfiguredProductTypesRuntime,
} from "@/modules/products/runtime/productConfigurationRuntime";
import {
  productCatalogExporter,
  productPreferences,
  productRepository,
  resetProductRepositoryToDemo,
} from "@/modules/products/runtime/productModuleRuntime";
import { createProductDemoApiRuntime } from "@/modules/products/runtime/createProductDemoApiRuntime";
import { quotePreferences, quoteRepository } from "@/modules/quotes/runtime/quoteModuleRuntime";
import { createQuoteDemoApiRuntime } from "@/modules/quotes/runtime/createQuoteDemoApiRuntime";
import { returnRepository } from "@/modules/returns/runtime/returnModuleRuntime";
import { createReturnDemoApiRuntime } from "@/modules/returns/runtime/createReturnDemoApiRuntime";
import {
  getPickupLocationsRuntime,
  getReturnLocationsRuntime,
  getShippingProviderConfigurationsRuntime,
  saveShippingProviderConfigurationsRuntime,
} from "@/modules/shipping/runtime/shippingConfigurationRuntime";
import { shippingProviderRegistry, shippingRepository } from "@/modules/shipping/runtime/shippingModuleRuntime";
import { createShippingDemoApiRuntime } from "@/modules/shipping/runtime/createShippingDemoApiRuntime";
import { supportCaseRepository } from "@/modules/support/runtime/supportModuleRuntime";
import { taskActivityRepository } from "@/modules/tasks/runtime/taskModuleRuntime";
import { createTaskDemoApiRuntime } from "@/modules/tasks/runtime/createTaskDemoApiRuntime";
import { createSupportDemoApiRuntime } from "@/modules/support/runtime/createSupportDemoApiRuntime";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { createContactOpportunityCreationRuntime } from "@/workflows/contact-opportunity-creation/runtime/createContactOpportunityCreationRuntime";
import {
  reconcileCustomerConversionRuntime,
  startCustomerConversionRuntime,
} from "@/workflows/customer-conversion/runtime/customerConversionRuntime";
import { createDealRecycleRuntime } from "@/workflows/deal-recycle/runtime/createDealRecycleRuntime";
import { createLeadQualificationRuntime } from "@/workflows/lead-qualification/runtime/createLeadQualificationRuntime";
import { createOrderClosingRuntime } from "@/workflows/order-closing/runtime/createOrderClosingRuntime";
import { collectCurrentPilotDataset } from "@/workspaces/people-access/pilot-acceptance/runtime/collectCurrentPilotDataset";
import { evaluatePilotAcceptance } from "@/workspaces/people-access/pilot-acceptance/runtime/pilotAcceptanceEvaluator";
import { createPassingPilotAcceptanceFixture } from "@/workspaces/people-access/pilot-acceptance/runtime/pilotAcceptanceFixture";
import {
  clearPilotAcceptanceState,
  getPilotAcceptanceState,
  savePilotAcceptanceResult,
  savePilotManualEvidence,
  savePilotMetricObservation,
  subscribeToPilotAcceptance,
} from "@/workspaces/people-access/pilot-acceptance/runtime/pilotEvidenceStore";
import type { ApplicationServiceBundle } from "./applicationServiceBundle";

export function createDemoApplicationServiceBundle(): ApplicationServiceBundle {
  const receivablesApi = new InMemoryReceivablesApiAdapter(invoiceRepository, paymentRepository);
  const shippingConfiguration = {
    getPickupLocations: getPickupLocationsRuntime,
    getReturnLocations: getReturnLocationsRuntime,
    getProviders: getShippingProviderConfigurationsRuntime,
    saveProviders: saveShippingProviderConfigurationsRuntime,
  };
  return {
    modules: {
      commercialEvidence: { repository: purchaseEvidenceRepository },
      contacts: { repository: contactRepository, preferences: contactPreferences, api: createContactDemoApiRuntime(contactRepository) },
      customers: {
        repository: customerRepository,
        runtime: {
          ensureReady: ensureCustomerRepositoryReady,
          reconcileFromPurchaseEvidence: reconcileCustomerRepositoryFromPurchaseEvidence,
          getMigrationProfile: getCustomerMigrationProfileRuntime,
        },
        api: createCustomerDemoApiRuntime(customerRepository),
      },
      deals: { api: createDealDemoApiRuntime(dealRepository), repository: dealRepository, stages: dealStageRepository, exporter: browserDealExporter },
      payments: {
        repository: paymentRepository,
        api: paymentApi,
        verticalSlice: createPaymentVerticalSlice(paymentApi),
        configuration: paymentConfigurationRepository,
      },
      invoices: {
        repository: invoiceRepository,
        api: invoiceApi,
        receivablesApi,
        receivableOperations: {
          list: getReceivableCollectionActivities,
          save: saveReceivableCollectionActivity,
          updateState: updateReceivableCollectionActivityState,
          subscribe: subscribeToReceivableCollectionActivities,
        },
        verticalSlice: createInvoiceVerticalSlice(invoiceApi, receivablesApi, paymentApi),
        configuration: invoiceConfigurationRepository,
      },
      leads: {
        repository: leadRepository,
        exporter: leadExporter,
        preferences: leadPreferences,
        webhookIngress: createLeadWebhookIngress(leadRepository),
        api: createLeadDemoApiRuntime(leadRepository),
      },
      orders: { api: createOrderDemoApiRuntime(orderRepository), repository: orderRepository, preferences: orderPreferences },
      organizations: { repository: organizationAccountRepository, api: createOrganizationDemoApiRuntime(organizationAccountRepository) },
      products: {
        api: createProductDemoApiRuntime(productRepository),
        repository: productRepository,
        exporter: productCatalogExporter,
        preferences: productPreferences,
        resetCatalogToDemo: resetProductRepositoryToDemo,
        configuration: {
          getTypes: getConfiguredProductTypesRuntime,
          saveTypes: saveConfiguredProductTypesRuntime,
          getFields: getConfiguredProductFieldsRuntime,
          saveFields: saveConfiguredProductFieldsRuntime,
          isTypeUsed: isConfiguredProductTypeUsedRuntime,
          isFieldUsed: isConfiguredProductFieldUsedRuntime,
          getDefaults: getDefaultProductConfigurationRuntime,
          reset: resetProductConfigurationRuntime,
        },
      },
      quotes: { api: createQuoteDemoApiRuntime(quoteRepository), repository: quoteRepository, preferences: quotePreferences },
      returns: {
        repository: returnRepository,
        api: createReturnDemoApiRuntime(returnRepository, () => getWorkspaceContextSnapshot().workspaceId),
      },
      shipping: {
        repository: shippingRepository,
        providers: shippingProviderRegistry,
        configuration: shippingConfiguration,
        api: createShippingDemoApiRuntime(
          shippingRepository,
          shippingProviderRegistry,
          shippingConfiguration,
          () => getWorkspaceContextSnapshot().workspaceId,
        ),
      },
      support: { repository: supportCaseRepository, api: createSupportDemoApiRuntime(supportCaseRepository) },
      tasks: { repository: taskActivityRepository, api: createTaskDemoApiRuntime(taskActivityRepository, () => getWorkspaceContextSnapshot().workspaceId) },
    },
    workflows: {
      contactOpportunityCreation: createContactOpportunityCreationRuntime(),
      customerConversion: {
        reconcile: reconcileCustomerConversionRuntime,
        start: startCustomerConversionRuntime,
      },
      dealRecycle: createDealRecycleRuntime(),
      leadQualification: createLeadQualificationRuntime(),
      orderClosing: createOrderClosingRuntime(),
    },
    workspaces: {
      pilotAcceptance: {
        collectCurrentDataset: collectCurrentPilotDataset,
        evaluate: evaluatePilotAcceptance,
        createPassingFixture: createPassingPilotAcceptanceFixture,
        clearState: clearPilotAcceptanceState,
        getState: getPilotAcceptanceState,
        saveResult: savePilotAcceptanceResult,
        saveManualEvidence: savePilotManualEvidence,
        saveMetricObservation: savePilotMetricObservation,
        subscribe: subscribeToPilotAcceptance,
      },
    },
  };
}
