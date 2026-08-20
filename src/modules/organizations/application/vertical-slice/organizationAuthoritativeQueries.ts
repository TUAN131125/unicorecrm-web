import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { OrganizationOverviewProjection } from "../ports/OrganizationApiRuntime";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";
import { getOrganizationApiRuntime } from "../composition/organizationApplicationServices";
import {
  getOrganizationAccountsSnapshot,
  replaceOrganizationAccounts,
  saveOrganizationAccountSnapshot,
} from "../../public/api";

const collection = createCollectionResource();
const details = new Map<string, AuthoritativeResource<OrganizationAccount>>();
const overviews = new Map<string, AuthoritativeResource<OrganizationOverviewProjection>>();

export function getOrganizationAccountCollectionResource(): AuthoritativeResource<AuthoritativePage<OrganizationAccount>> { return collection; }

export function getOrganizationAccountDetailResource(organizationId: string): AuthoritativeResource<OrganizationAccount> {
  let resource = details.get(organizationId);
  if (!resource) {
    resource = createDetailResource(organizationId);
    details.set(organizationId, resource);
  }
  return resource;
}

export function getOrganizationOverviewResource(organizationId: string): AuthoritativeResource<OrganizationOverviewProjection> {
  let resource = overviews.get(organizationId);
  if (!resource) {
    resource = createOverviewResource(organizationId);
    overviews.set(organizationId, resource);
  }
  return resource;
}

function createCollectionResource(): AuthoritativeResource<AuthoritativePage<OrganizationAccount>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await getOrganizationApiRuntime().queries.list({}, signal);
    runBackendProjection("organizations", () => replaceOrganizationAccounts(page.items));
    return page;
  });
  subscribeModuleQueryInvalidation("organizations", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function createDetailResource(organizationId: string): AuthoritativeResource<OrganizationAccount> {
  const resource = createAuthoritativeResource(async (signal) => {
    const organization = await getOrganizationApiRuntime().queries.get(organizationId, signal);
    runBackendProjection("organizations", () => saveOrganizationAccountSnapshot(organization));
    return organization;
  });
  subscribeModuleQueryInvalidation("organizations", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function createOverviewResource(organizationId: string): AuthoritativeResource<OrganizationOverviewProjection> {
  const resource = createAuthoritativeResource(async (signal) => {
    const overview = await getOrganizationApiRuntime().queries.getOverview(organizationId, signal);
    runBackendProjection("organizations", () => {
      const current = getOrganizationAccountsSnapshot();
      replaceOrganizationAccounts(current.some((item) => item.id === overview.organization.id)
        ? current.map((item) => item.id === overview.organization.id ? overview.organization : item)
        : [...current, overview.organization]);
    });
    return overview;
  });
  subscribeModuleQueryInvalidation("organizations", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}
