import { useEffect, useState } from "react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";
import { getOrganizationAccountCollectionResource } from "../../application/vertical-slice/organizationAuthoritativeQueries";
import {
  getOrganizationAccountsSnapshot,
  replaceOrganizationAccounts,
  subscribeToOrganizationAccounts,
} from "../../public/api";

export function useOrganizationAccounts() {
  const workspace = useWorkspaceContextSnapshot();
  const [accounts, setAccounts] = useState<OrganizationAccount[]>(getOrganizationAccountsSnapshot);
  const query = useModuleAuthoritativeResource(
    getOrganizationAccountCollectionResource(),
    {
      scopeKey: workspace.workspaceId,
      onScopeChange: () => replaceOrganizationAccounts([]),
    },
  );

  useEffect(() => subscribeToOrganizationAccounts(setAccounts), []);

  return { accounts, query };
}
