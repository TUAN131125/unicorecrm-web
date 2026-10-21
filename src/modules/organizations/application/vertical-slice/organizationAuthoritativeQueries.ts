import {
  createAuthoritativeResource,
  runBackendProjection,
  runWorkspaceScopeReset,
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
} from "../../public/api";

import { getAuthSessionSnapshot, subscribeToAuthSession } from "@/platform/identity-auth";
import { getWorkspaceContextSnapshot, subscribeToWorkspaceContext } from "@/platform/workspace-context";
import { getAccessControlSnapshot, getAccessGovernanceRuntimeBinding, isAccessGovernanceRuntimeConfigured, resolveEffectiveAccess, subscribeToAccessControl } from "@/platform/access-control";
import { registerWorkspaceScopeDisposer } from "@/platform/workspace-scope";
import { normalizeApplicationError, ApplicationError } from "@/shared/domain";

let collection: AuthoritativeResource<AuthoritativePage<OrganizationAccount>> | undefined;
let authority: string | undefined;
let generation = 0;
let subscribed = false;
let governance: ReturnType<typeof getAccessGovernanceRuntimeBinding> | undefined;
let unsubscribeGovernance: (() => void) | undefined;
const details = new Map<string, AuthoritativeResource<OrganizationAccount>>();
const overviews = new Map<string, AuthoritativeResource<OrganizationOverviewProjection>>();

function readAuthority(): string {
  const session = getAuthSessionSnapshot();
  if (!session) return "unauthenticated";
  const workspace = getWorkspaceContextSnapshot();
  const binding = isAccessGovernanceRuntimeConfigured() ? getAccessGovernanceRuntimeBinding() : undefined;
  const state = binding?.getState();
  const access = resolveEffectiveAccess(workspace.workspaceId);
  return JSON.stringify([workspace.workspaceId, session?.sessionId, session?.status, session?.principal.accountId,
    access.accountId, access.membershipId, access.memberId, state?.workspaceId, state?.loading,
    state?.authorityRevision ?? state?.snapshot?.revision ?? getAccessControlSnapshot(workspace.workspaceId).revision]);
}

function retire(): void {
  generation++;
  const resources = [collection, ...details.values(), ...overviews.values()];
  // Keep handles stable: consumers may memoize a resource across authority changes.
  for (const resource of resources) resource?.reset();
  runWorkspaceScopeReset(() => replaceOrganizationAccounts([]));
}
function syncAuthority(): void {
  if (getOrganizationApiRuntime().mode !== "connected") return;
  const next = readAuthority();
  if (next === authority) return;
  authority = next;
  retire();
}
function ensureAuthority(): void {
  if (getOrganizationApiRuntime().mode !== "connected") { authority = readAuthority(); return; }
  if (!subscribed) {
    subscribed = true;
    subscribeToAuthSession(syncAuthority);
    subscribeToWorkspaceContext(syncAuthority);
    subscribeToAccessControl(syncAuthority);
  }
  const nextGovernance = isAccessGovernanceRuntimeConfigured() ? getAccessGovernanceRuntimeBinding() : undefined;
  if (governance !== nextGovernance) {
    unsubscribeGovernance?.();
    governance = nextGovernance;
    unsubscribeGovernance = governance?.subscribe(syncAuthority);
  }
  syncAuthority();
}
registerWorkspaceScopeDisposer(() => { authority = undefined; retire(); });

// Each request captures authority; reset handles may safely refetch for the new actor.
function authorityGuard(): (signal: AbortSignal) => void {
  const owner = authority;
  const ownerGeneration = generation;
  return signal => {
    signal.throwIfAborted();
    if (owner !== readAuthority() || ownerGeneration !== generation) throw new DOMException("Organization read authority retired", "AbortError");
  };
}
function retainData(error: ApplicationError): boolean {
  return !["AUTHENTICATION", "AUTHORIZATION", "NOT_FOUND"].includes(error.category);
}
function evictUnavailable(error: unknown, source: object, organizationId?: string): void {
  if (retainData(normalizeApplicationError(error))) return;
  runBackendProjection("organizations", () => replaceOrganizationAccounts(organizationId
    ? getOrganizationAccountsSnapshot().filter(item => item.id !== organizationId)
    : []));
  const page = collection?.getSnapshot();
  if (collection !== source && page?.data) {
    const { totalCount: _previousCount, ...pageInfo } = page.data.pageInfo;
    collection?.replace({ ...page.data, items: organizationId ? page.data.items.filter(item => item.id !== organizationId) : [], pageInfo });
  }
  for (const [id, sibling] of [...details, ...overviews]) {
    if (sibling !== source && (!organizationId || id === organizationId)
      && (sibling.getSnapshot().data !== undefined || sibling.getSnapshot().state === "LOADING")) sibling.reset();
  }
}
function assertIdentity(organization: OrganizationAccount, expectedId = organization.id): void {
  if (organization.id !== expectedId || organization.workspaceId !== getWorkspaceContextSnapshot().workspaceId) {
    throw new ApplicationError({ code: "ORGANIZATION_READ_SCOPE_MISMATCH", category: "AUTHORIZATION", message: "Organization response does not match the requested scope." });
  }
}
function project(organization: OrganizationAccount, source: object): void {
  // Replace the entire authorized DTO; merging would restore withheld optional fields.
  const current = getOrganizationAccountsSnapshot();
  replaceOrganizationAccounts(current.some(item => item.id === organization.id)
    ? current.map(item => item.id === organization.id ? organization : item)
    : [...current, organization]);
  reconcileCachedRecord(organization, source);
}
function reconcileCachedRecord(organization: OrganizationAccount, source: object): void {
  const page = collection?.getSnapshot();
  if (collection !== source && page?.data) collection?.replace({ ...page.data, items: page.data.items.map(item => item.id === organization.id ? organization : item) });
  const detail = details.get(organization.id);
  if (detail !== source && detail?.getSnapshot().data !== undefined) detail.replace(organization);
  const overview = overviews.get(organization.id);
  if (overview !== source && overview?.getSnapshot().data) overview.reset();
}
function subscribeInvalidation<T>(resource: AuthoritativeResource<T>): AuthoritativeResource<T> {
  subscribeModuleQueryInvalidation("organizations", async () => {
    if (resource.getSnapshot().state !== "IDLE") await resource.refresh();
  });
  return resource;
}
export function getOrganizationAccountCollectionResource(): AuthoritativeResource<AuthoritativePage<OrganizationAccount>> {
  ensureAuthority();
  collection ??= createCollectionResource();
  return collection;
}

export function getOrganizationAccountDetailResource(organizationId: string): AuthoritativeResource<OrganizationAccount> {
  ensureAuthority();
  let resource = details.get(organizationId);
  if (!resource) {
    resource = createDetailResource(organizationId);
    details.set(organizationId, resource);
  }
  return resource;
}

export function getOrganizationOverviewResource(organizationId: string): AuthoritativeResource<OrganizationOverviewProjection> {
  ensureAuthority();
  let resource = overviews.get(organizationId);
  if (!resource) {
    resource = createOverviewResource(organizationId);
    overviews.set(organizationId, resource);
  }
  return resource;
}

function createCollectionResource(): AuthoritativeResource<AuthoritativePage<OrganizationAccount>> {
  const resource = createAuthoritativeResource(async signal => {
    const assertCurrent = authorityGuard();
    assertCurrent(signal);
    try {
      const page = await getOrganizationApiRuntime().queries.list({}, signal);
      assertCurrent(signal);
      for (const item of page.items) assertIdentity(item);
      runBackendProjection("organizations", () => {
        replaceOrganizationAccounts(page.items);
        for (const item of page.items) reconcileCachedRecord(item, resource);
      });
      return page;
    } catch (error) {
      assertCurrent(signal);
      evictUnavailable(error, resource);
      throw error;
    }
  }, { shouldRetainDataOnError: retainData });
  return subscribeInvalidation(resource);
}

function createDetailResource(organizationId: string): AuthoritativeResource<OrganizationAccount> {
  const resource = createAuthoritativeResource(async signal => {
    const assertCurrent = authorityGuard();
    assertCurrent(signal);
    try {
      const organization = await getOrganizationApiRuntime().queries.get(organizationId, signal);
      assertCurrent(signal);
      assertIdentity(organization, organizationId);
      runBackendProjection("organizations", () => project(organization, resource));
      return organization;
    } catch (error) {
      assertCurrent(signal);
      evictUnavailable(error, resource, organizationId);
      throw error;
    }
  }, { shouldRetainDataOnError: retainData });
  return subscribeInvalidation(resource);
}

function createOverviewResource(organizationId: string): AuthoritativeResource<OrganizationOverviewProjection> {
  const resource = createAuthoritativeResource(async signal => {
    const assertCurrent = authorityGuard();
    assertCurrent(signal);
    try {
      const overview = await getOrganizationApiRuntime().queries.getOverview(organizationId, signal);
      assertCurrent(signal);
      assertIdentity(overview.organization, organizationId);
      runBackendProjection("organizations", () => project(overview.organization, resource));
      return overview;
    } catch (error) {
      assertCurrent(signal);
      evictUnavailable(error, resource, organizationId);
      throw error;
    }
  }, { shouldRetainDataOnError: retainData });
  return subscribeInvalidation(resource);
}
