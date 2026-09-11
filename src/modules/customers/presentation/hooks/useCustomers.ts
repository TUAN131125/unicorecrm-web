import { useCallback, useEffect, useState } from "react";
import { getCustomerCollectionResource } from "../../application/vertical-slice/customerAuthoritativeQueries";
import { getCustomersSnapshot, replaceCustomerSnapshot, subscribeToCustomers, type Customer } from "../../public/api";
import { getAllCustomerCareCardsSnapshot } from "../../public/api";
import { useModuleAuthoritativeResource, useServerPagedCollection } from "@/shared/operations";
import type { ModuleListQuery } from "@/shared/application";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getCustomerApiRuntime, isCustomerConnectedApiRuntime } from "../../application/composition/customerApplicationServices";

export function useCustomers(options: {
  loadAuthoritative?: boolean;
  query?: Omit<ModuleListQuery, "cursor" | "limit">;
} = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const connected = isCustomerConnectedApiRuntime();
  const [customers, setCustomers] = useState<Customer[]>(getCustomersSnapshot);
  const query = useModuleAuthoritativeResource(getCustomerCollectionResource(), {
    enabled: !connected && (options.loadAuthoritative ?? true),
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceCustomerSnapshot({ customers: [], careCards: getAllCustomerCareCardsSnapshot() }),
  });
  const project = useCallback((records: readonly Customer[]) => {
    replaceCustomerSnapshot({ customers: [...records], careCards: getAllCustomerCareCardsSnapshot() });
  }, []);
  const loadPage = useCallback((request: ModuleListQuery, signal: AbortSignal) => (
    getCustomerApiRuntime().queries.list(request, signal)
  ), []);
  const serverPagination = useServerPagedCollection({
    connected,
    scopeKey: workspace.workspaceId,
    query: options.query,
    enabled: options.loadAuthoritative ?? true,
    project,
    loadPage,
    errorCodePrefix: "CUSTOMERS",
  });
  useEffect(() => subscribeToCustomers(setCustomers), []);
  return {
    customers: connected ? serverPagination.items : customers,
    query: connected ? serverPagination : query,
    serverPagination,
  };
}
