import { useCallback, useEffect, useState } from "react";
import { getCustomerCollectionResource } from "../../application/vertical-slice/customerAuthoritativeQueries";
import { getCustomersSnapshot, replaceCustomerSnapshot, subscribeToCustomers, type Customer } from "../../public/api";
import { getAllCustomerCareCardsSnapshot } from "../../public/api";
import { useModuleAuthoritativeResource, useServerPagedCollection } from "@/shared/operations";
import { runBackendProjection, type ModuleListQuery } from "@/shared/application";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useEffectiveAccess } from "@/platform/access-control";
import { getCustomerApiRuntime, isCustomerConnectedApiRuntime } from "../../application/composition/customerApplicationServices";
import type { CustomerListItem } from "../../application/ports/CustomerApiRuntime";

export function useCustomers(options: {
  loadAuthoritative?: boolean;
  query?: Omit<ModuleListQuery, "cursor" | "limit">;
} = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  const authorityScope = JSON.stringify([workspace.workspaceId, access.accountId, access.membershipId, access.authorityRevision]);
  const connected = isCustomerConnectedApiRuntime();
  const [customers, setCustomers] = useState<Customer[]>(getCustomersSnapshot);
  const query = useModuleAuthoritativeResource(getCustomerCollectionResource(), {
    enabled: !connected && (options.loadAuthoritative ?? true),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceCustomerSnapshot({ customers: [], careCards: getAllCustomerCareCardsSnapshot() }),
  });
  const project = useCallback((records: readonly CustomerListItem[]) => {
    runBackendProjection("customers", () =>
      replaceCustomerSnapshot({ customers: records.map(({ listIdentity: _identity, ...customer }) => customer), careCards: getAllCustomerCareCardsSnapshot() }),
    );
  }, []);
  const loadPage = useCallback((request: ModuleListQuery, signal: AbortSignal) => (
    getCustomerApiRuntime().queries.list(request, signal)
  ), []);
  const serverPagination = useServerPagedCollection<CustomerListItem>({
    connected,
    scopeKey: workspace.workspaceId,
    authorizationScopeKey: authorityScope,
    query: options.query,
    enabled: options.loadAuthoritative ?? true,
    project,
    loadPage,
    errorCodePrefix: "CUSTOMERS",
    refreshIntervalMs: 5000,
  });
  useEffect(() => subscribeToCustomers(setCustomers), []);
  return {
    customers: connected ? serverPagination.items : customers,
    query: connected ? serverPagination : query,
    serverPagination,
    listIdentities: new Map(serverPagination.items.map(item => [item.id, item.listIdentity])),
  };
}
