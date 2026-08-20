import { useEffect, useState } from "react";
import type { SupportCase } from "../../domain/model/supportCase.types";
import { getSupportCaseCollectionResource } from "../../application/vertical-slice/supportAuthoritativeQueries";
import { getSupportCasesSnapshot, replaceSupportCases, subscribeToSupportCases } from "../../public/cases";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";


export function useSupportCases(options: { loadAuthoritative?: boolean } = {}) {
  const workspace = useWorkspaceContextSnapshot();
  const [cases, setCasesState] = useState<SupportCase[]>(getSupportCasesSnapshot);
  const query = useModuleAuthoritativeResource(getSupportCaseCollectionResource(), {
    enabled: options.loadAuthoritative ?? true,
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceSupportCases([]),
  });

  useEffect(() => subscribeToSupportCases(setCasesState), []);

  return { cases, query };
}
