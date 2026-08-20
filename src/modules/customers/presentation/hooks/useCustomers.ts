import { useEffect, useState } from "react";
import { getCustomerCollectionResource } from "../../application/vertical-slice/customerAuthoritativeQueries";
import { getCustomersSnapshot, replaceCustomerSnapshot, subscribeToCustomers, type Customer } from "../../public/api";
import { getAllCustomerCareCardsSnapshot } from "../../public/api";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useCustomers(options: { loadAuthoritative?: boolean } = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const [customers, setCustomers] = useState<Customer[]>(getCustomersSnapshot);
  const query = useModuleAuthoritativeResource(getCustomerCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceCustomerSnapshot({ customers: [], careCards: getAllCustomerCareCardsSnapshot() }),
  });
  useEffect(() => subscribeToCustomers(setCustomers), []);
  return { customers, query };
}
