import type { ContactApplicationServices } from "@/modules/contacts/application/composition/contactApplicationServices";
import type { Contact } from "@/modules/contacts/domain/model/contact.types";
import type { CustomerApplicationServices } from "@/modules/customers/application/composition/customerApplicationServices";
import type { Customer, CustomerCareCard, CustomerRepositorySnapshot } from "@/modules/customers/domain/model/customer.types";
import type { DealApplicationServices } from "@/modules/deals/application/composition/dealApplicationServices";
import type { Deal, DealPipelineDefinition, OpportunityStageConfig } from "@/modules/deals/domain/model/deal.types";
import type { LeadApplicationServices } from "@/modules/leads/application/composition/leadApplicationServices";
import type { Lead } from "@/modules/leads/domain/model/lead.types";
import type { OrganizationApplicationServices } from "@/modules/organizations/application/composition/organizationApplicationServices";
import type { OrganizationAccount } from "@/modules/organizations/domain/model/organizationAccount.types";
import type { ProductApplicationServices } from "@/modules/products/application/composition/productApplicationServices";
import type { ConfiguredProductField, ConfiguredProductType } from "@/modules/products/domain/model/productConfiguration.types";
import type { Product } from "@/modules/products/domain/model/product.types";
import type { HttpClient } from "@/platform/api/client";
import { createLeadConnectedApiRuntime } from "@/modules/leads/infrastructure/http/createLeadConnectedApiRuntime";
import { createContactConnectedApiRuntime } from "@/modules/contacts/infrastructure/http/createContactConnectedApiRuntime";
import { createCustomerConnectedApiRuntime } from "@/modules/customers/infrastructure/http/createCustomerConnectedApiRuntime";
import { createDealConnectedApiRuntime } from "@/modules/deals/infrastructure/http/createDealConnectedApiRuntime";
import { DEFAULT_DEAL_STAGES } from "@/modules/deals/domain/rules/dealStages";
import { createOrganizationConnectedApiRuntime } from "@/modules/organizations/infrastructure/http/createOrganizationConnectedApiRuntime";
import { createProductConnectedApiRuntime } from "@/modules/products/infrastructure/http/createProductConnectedApiRuntime";
import { relationshipRefKey } from "@/platform/identity";
import {
  ConnectedCollectionProjection,
  ConnectedOperationUnavailableError,
  ConnectedSnapshotProjection,
  unavailableConnectedOperation,
} from "./connectedProjectionRepositories";
import {
  createConnectedPreferencePort,
  csvCell,
  downloadConnectedTextFile,
} from "./connectedClientUtilities";

export interface ConnectedCrmModuleServices {
  contacts: ContactApplicationServices;
  customers: CustomerApplicationServices;
  deals: DealApplicationServices;
  leads: LeadApplicationServices;
  organizations: OrganizationApplicationServices;
  products: ProductApplicationServices;
}

export function createConnectedCrmModuleServices(httpClient: HttpClient): ConnectedCrmModuleServices {
  return {
    contacts: createContacts(httpClient),
    customers: createCustomers(httpClient),
    deals: createDeals(httpClient),
    leads: createLeads(httpClient),
    organizations: createOrganizations(httpClient),
    products: createProducts(httpClient),
  };
}

function createContacts(httpClient: HttpClient): ContactApplicationServices {
  const projection = new ConnectedCollectionProjection<Contact>("contacts", (record) => record.id);
  return {
    repository: {
      list: () => projection.list(),
      getById: (id) => projection.getById(id),
      replace: (records) => projection.replace(records),
      subscribe: (listener) => projection.subscribe(listener),
    },
    preferences: createConnectedPreferencePort(),
    api: createContactConnectedApiRuntime(httpClient),
  };
}

function createCustomers(httpClient: HttpClient): CustomerApplicationServices {
  const projection = new ConnectedSnapshotProjection<CustomerRepositorySnapshot>("customers", {
    customers: [],
    careCards: [],
  });
  return {
    repository: {
      snapshot: () => projection.snapshot(),
      list: () => projection.snapshot().customers,
      listCareCards: () => projection.snapshot().careCards,
      getById: (id) => projection.snapshot().customers.find((record) => record.id === id),
      getByAlias: (alias) => projection.snapshot().customers.find((record) => record.id === alias || record.customerCode === alias || record.legacyAliases?.includes(alias)),
      findByRelationship: (workspaceId, relationshipRef) => projection.snapshot().customers.find((record) => (
        record.workspaceId === workspaceId
        && relationshipRefKey(record.relationshipRef) === relationshipRefKey(relationshipRef)
      )),
      save: (customer: Customer) => projection.update((snapshot) => ({
        ...snapshot,
        customers: upsertById(snapshot.customers, customer),
      })).customers.find((record) => record.id === customer.id) ?? customer,
      saveCareCard: (card: CustomerCareCard) => projection.update((snapshot) => ({
        ...snapshot,
        careCards: upsertById(snapshot.careCards, card),
      })).careCards.find((record) => record.id === card.id) ?? card,
      replace: (snapshot) => projection.replace(snapshot),
      subscribe: (listener) => projection.subscribe(listener),
    },
    runtime: {
      ensureReady: () => undefined,
      reconcileFromPurchaseEvidence: unavailableConnectedOperation("Customer reconciliation"),
      getMigrationProfile: () => undefined,
    },
    api: createCustomerConnectedApiRuntime(httpClient),
  };
}

function createDeals(httpClient: HttpClient): DealApplicationServices {
  const deals = new ConnectedCollectionProjection<Deal>("deals", (record) => record.id);
  // The Deal stage catalogue is fixed by the Deals backend (DealStages), not configurable
  // and not exposed by any read operation. Seeding the projection with the canonical
  // catalogue mirrors that authority; leaving it empty would silently disable the Deal
  // pipeline because a deferred workspace-configuration API does not exist yet.
  const stages = new ConnectedSnapshotProjection<OpportunityStageConfig[]>("deals", DEFAULT_DEAL_STAGES);
  const pipelines = new ConnectedSnapshotProjection<DealPipelineDefinition[]>("deals", []);
  return {
    api: createDealConnectedApiRuntime(httpClient),
    repository: {
      list: () => deals.list(),
      getById: (id) => deals.getById(id),
      replace: (records) => deals.replace(records),
      subscribe: (listener) => deals.subscribe(listener),
    },
    stages: {
      list: () => stages.snapshot(),
      replace: (records) => stages.replace(records),
      reset: unavailableConnectedOperation("Deal stage reset"),
      subscribe: (listener) => stages.subscribe(listener),
      listPipelines: () => pipelines.snapshot(),
      // Pipeline configuration is workspace configuration owned by the backend: every
      // `/crm-configuration/pipelines` write operation is BLOCKED in OpenAPI, and nothing
      // projects pipelines from the backend, so a presentation-originated write here would
      // only ever be a local one. Declared unavailable rather than left to fail inside the
      // projection guard, so the boundary and the UI can refuse first.
      replacePipelines: unavailableConnectedOperation("Deal pipeline configuration save"),
    },
    exporter: {
      exportCsv(filename, records, columns) {
        const rows = [columns.map((column) => csvCell(column.label)).join(",")];
        rows.push(...records.map((record) => columns.map((column) => csvCell(column.value(record))).join(",")));
        downloadConnectedTextFile(filename, `${rows.join("\n")}\n`, "text/csv;charset=utf-8");
      },
    },
  };
}

function createLeads(httpClient: HttpClient): LeadApplicationServices {
  const projection = new ConnectedCollectionProjection<Lead>("leads", (record) => record.id);
  return {
    repository: {
      list: () => projection.list(),
      getById: (id) => projection.getById(id),
      replace: (records) => projection.replace(records),
      subscribe: (listener) => projection.subscribe(listener),
    },
    exporter: {
      exportCsv(records, filename) {
        const columns: Array<[string, (record: Lead) => string]> = [
          ["id", (record) => record.id],
          ["name", (record) => record.name],
          ["email", (record) => record.email ?? ""],
          ["phone", (record) => record.phone ?? ""],
        ];
        const rows = [columns.map(([label]) => csvCell(label)).join(",")];
        rows.push(...records.map((record) => columns.map(([, read]) => csvCell(read(record))).join(",")));
        downloadConnectedTextFile(filename, `${rows.join("\n")}\n`, "text/csv;charset=utf-8");
      },
    },
    preferences: createConnectedPreferencePort(),
    webhookIngress: {
      ingest: async () => {
        throw new ConnectedOperationUnavailableError("Lead webhook ingress");
      },
    },
    api: createLeadConnectedApiRuntime(httpClient),
  };
}

function createOrganizations(httpClient: HttpClient): OrganizationApplicationServices {
  const projection = new ConnectedCollectionProjection<OrganizationAccount>("organizations", (record) => record.id);
  return {
    repository: {
      list: () => projection.list(),
      findById: (id) => projection.getById(id),
      replace: (records) => projection.replace(records),
      subscribe: (listener) => projection.subscribe(listener),
    },
    api: createOrganizationConnectedApiRuntime(httpClient),
  };
}

function createProducts(httpClient: HttpClient): ProductApplicationServices {
  const projection = new ConnectedCollectionProjection<Product>("products", (record) => record.id);
  const types = new ConnectedSnapshotProjection<ConfiguredProductType[]>("products", []);
  const fields = new ConnectedSnapshotProjection<ConfiguredProductField[]>("products", []);
  return {
    api: createProductConnectedApiRuntime(httpClient),
    repository: {
      list: () => projection.list(),
      replace: (records) => projection.replace(records),
      subscribe: (listener) => projection.subscribe(listener),
    },
    exporter: {
      exportJson(records) {
        downloadConnectedTextFile("products.json", `${JSON.stringify(records, null, 2)}\n`, "application/json;charset=utf-8");
      },
      exportCsv(records) {
        const rows = ["id,sku,name,status"];
        rows.push(...records.map((record) => [record.id, record.sku, record.name, record.status].map(csvCell).join(",")));
        downloadConnectedTextFile("products.csv", `${rows.join("\n")}\n`, "text/csv;charset=utf-8");
      },
    },
    preferences: createConnectedPreferencePort(),
    configuration: {
      getTypes: () => types.snapshot(),
      // `/products/configuration/types` and `/products/configuration/fields` writes are
      // BLOCKED in OpenAPI and no backend read feeds these projections, so a connected save
      // could only be a local write.
      saveTypes: unavailableConnectedOperation("Product type configuration save"),
      getFields: () => fields.snapshot(),
      saveFields: unavailableConnectedOperation("Product field configuration save"),
      isTypeUsed: (typeCode, products) => products.some((product) => product.type === typeCode),
      isFieldUsed: (fieldKey, products) => products.some((product) => fieldKey in product),
      getDefaults: () => ({ types: [], fields: [] }),
      reset: unavailableConnectedOperation("Product configuration reset"),
    },
    resetCatalogToDemo: unavailableConnectedOperation("Product demo catalog reset"),
  };
}

function upsertById<T extends { id: string }>(records: readonly T[], record: T): T[] {
  return records.some((candidate) => candidate.id === record.id)
    ? records.map((candidate) => candidate.id === record.id ? record : candidate)
    : [...records, record];
}
