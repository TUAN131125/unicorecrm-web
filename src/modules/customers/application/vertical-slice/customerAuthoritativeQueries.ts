import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { Customer360Projection } from "../ports/CustomerApiRuntime";
import type { Customer } from "../../domain/model/customer.types";
import { getCustomerApiRuntime } from "../composition/customerApplicationServices";
import {
  getAllCustomerCareCardsSnapshot,
  replaceCustomerSnapshot,
  saveCustomerSnapshot,
} from "../../public/api";

const collection = createCollectionResource();
const details = new Map<string, AuthoritativeResource<Customer>>();
const projections360 = new Map<string, AuthoritativeResource<Customer360Projection>>();

export function getCustomerCollectionResource(): AuthoritativeResource<AuthoritativePage<Customer>> { return collection; }

export function getCustomerDetailResource(customerId: string): AuthoritativeResource<Customer> {
  let resource = details.get(customerId);
  if (!resource) {
    resource = createDetailResource(customerId);
    details.set(customerId, resource);
  }
  return resource;
}

export function getCustomer360Resource(customerId: string): AuthoritativeResource<Customer360Projection> {
  let resource = projections360.get(customerId);
  if (!resource) {
    resource = create360Resource(customerId);
    projections360.set(customerId, resource);
  }
  return resource;
}

function createCollectionResource(): AuthoritativeResource<AuthoritativePage<Customer>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await getCustomerApiRuntime().queries.list({}, signal);
    runBackendProjection("customers", () => replaceCustomerSnapshot({ customers: page.items, careCards: getAllCustomerCareCardsSnapshot() }));
    return page;
  });
  subscribeModuleQueryInvalidation("customers", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function createDetailResource(customerId: string): AuthoritativeResource<Customer> {
  const resource = createAuthoritativeResource(async (signal) => {
    const customer = await getCustomerApiRuntime().queries.get(customerId, signal);
    runBackendProjection("customers", () => saveCustomerSnapshot(customer));
    return customer;
  });
  subscribeModuleQueryInvalidation("customers", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function create360Resource(customerId: string): AuthoritativeResource<Customer360Projection> {
  const resource = createAuthoritativeResource(async (signal) => {
    const projection = await getCustomerApiRuntime().queries.get360(customerId, signal);
    runBackendProjection("customers", () => saveCustomerSnapshot(projection.customer));
    return projection;
  });
  subscribeModuleQueryInvalidation("customers", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}
