import type { ApplicationModuleServiceBundle, ApplicationWorkflowServiceBundle, ApplicationWorkspaceServiceBundle } from "../applicationServiceBundle";
import type { PilotAcceptanceWorkspaceState } from "@/workspaces/people-access/pilot-acceptance/domain/pilotAcceptance.types";
import { connectedOperationUnavailable, declareUnavailableConnectedWorkflow, unavailableConnectedOperation } from "./connectedProjectionRepositories";
import { CONTACT_OPPORTUNITY_CREATION_OPERATION } from "@/workflows/contact-opportunity-creation";
// Imported from the availability module rather than the workflow barrel: the barrel also
// exports the coordinator, which pulls the Deals module barrel — and its presentation
// components — into the composition graph. Composition must not depend on presentation.
import { CUSTOMER_COMMERCIAL_ACTIONS_OPERATION } from "@/workflows/customer-commercial-actions/application/customerCommercialActionsAvailability";
import { WORK_ACTIVATION_OPERATION } from "@/workflows/work-activation/application/workActivationAvailability";
import { CUSTOMER_CONVERSION_OPERATION } from "@/workflows/customer-conversion/application/customerConversionAvailability";
import { DEAL_RECYCLE_OPERATION } from "@/workflows/deal-recycle/application/dealRecycleAvailability";
import { ORDER_CLOSING_OPERATION } from "@/workflows/order-closing/application/orderClosingAvailability";
import {
  LEAD_DIRECT_SALE_QUALIFICATION_OPERATION,
  LEAD_ORGANIZATION_QUALIFICATION_OPERATION,
} from "@/workflows/lead-qualification/application/leadQualificationAvailability";

export function createConnectedWorkflowServices(
  modules: ApplicationModuleServiceBundle,
): ApplicationWorkflowServiceBundle {
  // WF-04 is BLOCKED with `connectedFrontendCoordinatorAllowed: false`. It has no ports to
  // bind — the workflow module calls `deal.create` and `task.create` directly — so the
  // connected composition declares it unavailable here instead. Both commands are
  // PRODUCTION_CONTRACT_READY, so nothing else would stop the frontend from committing a
  // Deal and then a Task for a workflow the backend owns.
  declareUnavailableConnectedWorkflow(CUSTOMER_COMMERCIAL_ACTIONS_OPERATION);
  // WF-21 work-activation: same shape. `deal.create`, `deal.update-next-action` and
  // `task.create` are all READY, so only WF-21's own ownership can contain the sequence.
  declareUnavailableConnectedWorkflow(WORK_ACTIVATION_OPERATION);
  // Connected Lead qualification admits NURTURE and OPPORTUNITY through their backend workflow
  // routes. Direct Sale and Organization Account conversion remain truthful, separately declared
  // unavailable instead of being conflated with authorization for the admitted operations.
  declareUnavailableConnectedWorkflow(LEAD_DIRECT_SALE_QUALIFICATION_OPERATION);
  declareUnavailableConnectedWorkflow(LEAD_ORGANIZATION_QUALIFICATION_OPERATION);
  return {
    // WF-01 is BLOCKED with `connectedFrontendCoordinatorAllowed: false` and has no backend
    // workflow operation. Declaring the workflow itself unavailable — rather than only its
    // individual port members — lets presentation refuse on WF-01 before the first module
    // mutation, instead of inheriting protection from whatever Contact writes happen to be
    // blocked today.
    contactOpportunityCreation: {
      contacts: {
        getById: (contactId) => modules.contacts.repository.getById(contactId),
        save: unavailableConnectedOperation(CONTACT_OPPORTUNITY_CREATION_OPERATION),
      },
      deals: {
        create: unavailableConnectedOperation(CONTACT_OPPORTUNITY_CREATION_OPERATION),
      },
    },
    // WF-05 is BLOCKED on DEC-WORKFLOW-CUSTOMER-CONVERSION with
    // `connectedFrontendCoordinatorAllowed: false`. Binding through
    // `unavailableConnectedOperation` declares WF-05 at bind time, so the workflow boundary
    // and its callers refuse on WF-05 itself rather than on Customer write availability.
    customerConversion: {
      reconcile: unavailableConnectedOperation(CUSTOMER_CONVERSION_OPERATION),
      start: () => () => undefined,
    },
    // WF-09 is BLOCKED on DEC-WORKFLOW-DEAL-RECYCLE with
    // `connectedFrontendCoordinatorAllowed: false`. `deal.mark-lost-and-plan-recycle` has no
    // OpenAPI operation, so the close-lost and the recycle Task are a backend-orchestrated
    // pair the frontend may not assemble.
    dealRecycle: {
      deals: {
        getById: (dealId) => modules.deals.repository.getById(dealId),
        closeLost: unavailableConnectedOperation(DEAL_RECYCLE_OPERATION),
      },
      tasks: {
        create: unavailableConnectedOperation(DEAL_RECYCLE_OPERATION),
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
    // WF-12 is BLOCKED on DEC-WORKFLOW-ORDER-CLOSING with
    // `connectedFrontendCoordinatorAllowed: false`, even though CMD-046
    // `order.complete-from-fulfillment-evidence` is itself PRODUCTION_CONTRACT_READY. That
    // divergence is a backend/product ownership decision, so no dedicated workflow adapter is
    // invented: WF-12 declares its own unavailability and refusal is workflow-owned.
    orderClosing: {
      orders: {
        list: () => modules.orders.repository.list(),
        snapshot: () => modules.orders.repository.snapshot(),
        restore: unavailableConnectedOperation(ORDER_CLOSING_OPERATION),
        complete: unavailableConnectedOperation(ORDER_CLOSING_OPERATION),
      },
      payments: {
        evaluateCompletion: unavailableConnectedOperation(ORDER_CLOSING_OPERATION),
      },
      shipping: {
        listForOrder: (orderId) => modules.shipping.repository.list().filter((record) => record.sourceType === "ORDER" && record.sourceId === orderId),
      },
      evidence: {
        runAtomically: unavailableConnectedOperation(ORDER_CLOSING_OPERATION),
        findOrderCompleted: (orderId) => modules.commercialEvidence.repository.findBySource("ORDER", orderId, "ORDER_COMPLETED"),
        recordOrderCompleted: unavailableConnectedOperation(ORDER_CLOSING_OPERATION),
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
