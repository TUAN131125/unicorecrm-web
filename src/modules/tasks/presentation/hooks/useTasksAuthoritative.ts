import { getActivityCollectionResource, getTaskCollectionResource, getTaskReadAuthorityScope } from "../../application/vertical-slice/taskAuthoritativeQueries";
import { replaceTaskActivitySnapshot } from "../../public/api";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { useEffectiveAccess } from "@/platform/access-control";

export function useTasksAuthoritative() {
  useWorkspaceContextSnapshot();
  useAuthSessionSnapshot();
  useEffectiveAccess();
  const scope = getTaskReadAuthorityScope();
  const taskQuery = useModuleAuthoritativeResource(getTaskCollectionResource(), {
    scopeKey: scope,
    enabled: scope !== undefined,
    onScopeChange: () => replaceTaskActivitySnapshot({ tasks: [], activities: [] }),
  });
  useModuleAuthoritativeResource(getActivityCollectionResource(), {
    scopeKey: scope,
    enabled: scope !== undefined,
    onScopeChange: () => replaceTaskActivitySnapshot({ tasks: [], activities: [] }),
  });
  return taskQuery;
}
