import { getActivityCollectionResource, getTaskCollectionResource } from "../../application/vertical-slice/taskAuthoritativeQueries";
import { replaceTaskActivitySnapshot } from "../../public/api";
import { useModuleAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function useTasksAuthoritative() {
  const workspace = useWorkspaceContextSnapshot();
  const taskQuery = useModuleAuthoritativeResource(getTaskCollectionResource(), {
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceTaskActivitySnapshot({ tasks: [], activities: [] }),
  });
  useModuleAuthoritativeResource(getActivityCollectionResource(), {
    scopeKey: workspace.workspaceId,
    onScopeChange: () => replaceTaskActivitySnapshot({ tasks: [], activities: [] }),
  });
  return taskQuery;
}
