import type { ApplicationModuleServiceBundle, ApplicationWorkflowServiceBundle, ApplicationWorkspaceServiceBundle } from "../applicationServiceBundle";
import type { PilotAcceptanceWorkspaceState } from "@/workspaces/people-access/pilot-acceptance/domain/pilotAcceptance.types";
import { connectedOperationUnavailable } from "./connectedProjectionRepositories";

export function createConnectedWorkflowServices(
  modules: ApplicationModuleServiceBundle,
): ApplicationWorkflowServiceBundle {
  return {
    contactOpportunityCreation: {
      contacts: {
        getById: (contactId) => modules.contacts.repository.getById(contactId),
        save: () => connectedOperationUnavailable("Contact opportunity local contact save"),
      },
      deals: {
        create: () => connectedOperationUnavailable("Contact opportunity local deal creation"),
      },
    },
    customerConversion: {
      reconcile: () => connectedOperationUnavailable("Customer conversion local reconciliation"),
      start: () => () => undefined,
    },
    dealRecycle: {
      deals: {
        getById: (dealId) => modules.deals.repository.getById(dealId),
        closeLost: () => connectedOperationUnavailable("Deal recycle local close-lost"),
      },
      tasks: {
        create: () => connectedOperationUnavailable("Deal recycle local task creation"),
      },
    },
    leadQualification: {
      leads: {
        getById: (leadId) => modules.leads.repository.getById(leadId),
        close: () => connectedOperationUnavailable("Lead qualification local close"),
      },
      relationships: {
        resolve: () => connectedOperationUnavailable("Lead qualification local relationship resolution"),
      },
      tasks: {
        create: () => connectedOperationUnavailable("Lead qualification local task creation"),
      },
      deals: {
        create: () => connectedOperationUnavailable("Lead qualification local deal creation"),
      },
      quotes: {
        create: () => connectedOperationUnavailable("Lead qualification local quote creation"),
      },
      orders: {
        create: () => connectedOperationUnavailable("Lead qualification local order creation"),
      },
    },
    orderClosing: {
      orders: {
        list: () => modules.orders.repository.list(),
        snapshot: () => modules.orders.repository.snapshot(),
        restore: () => connectedOperationUnavailable("Order closing local restore"),
        complete: () => connectedOperationUnavailable("Order closing local completion"),
      },
      payments: {
        evaluateCompletion: () => connectedOperationUnavailable("Order closing local payment evaluation"),
      },
      shipping: {
        listForOrder: (orderId) => modules.shipping.repository.list().filter((record) => record.sourceType === "ORDER" && record.sourceId === orderId),
      },
      evidence: {
        runAtomically: () => connectedOperationUnavailable("Order closing local evidence transaction"),
        findOrderCompleted: (orderId) => modules.commercialEvidence.repository.findBySource("ORDER", orderId, "ORDER_COMPLETED"),
        recordOrderCompleted: () => connectedOperationUnavailable("Order closing local evidence write"),
      },
    },
  };
}

export function createConnectedWorkspaceServices(): ApplicationWorkspaceServiceBundle {
  const emptyState = (workspaceId: string): PilotAcceptanceWorkspaceState => ({
    version: 1,
    workspaceId,
    manualEvidence: [],
    metricObservations: [],
  });
  return {
    pilotAcceptance: {
      collectCurrentDataset: () => connectedOperationUnavailable("Pilot acceptance dataset collection"),
      evaluate: () => connectedOperationUnavailable("Pilot acceptance evaluation"),
      createPassingFixture: () => connectedOperationUnavailable("Pilot acceptance fixture creation"),
      clearState: () => connectedOperationUnavailable("Pilot acceptance state clear"),
      getState: (workspaceId) => emptyState(workspaceId),
      saveResult: () => connectedOperationUnavailable("Pilot acceptance result save"),
      saveManualEvidence: () => connectedOperationUnavailable("Pilot acceptance manual evidence save"),
      saveMetricObservation: () => connectedOperationUnavailable("Pilot acceptance metric save"),
      subscribe: () => () => undefined,
    },
  };
}
