import { useRef as useWorkspaceBindingRef } from "react";
import { useWorkspaceContextSnapshot as useWorkflowWorkspace } from "@/platform/workspace-context";
import { useTargetBoundWorkflow } from "@/shared/presentation/useTargetBoundWorkflow";

/** Order draft ownership spans its opening source and workspace. */
export function useOrderFormLifecycle(sourceIdentity: string) {
  const targetLifecycle = useTargetBoundWorkflow(sourceIdentity, "order-form");
  const workflowWorkspace = useWorkflowWorkspace().workspaceId;
  const currentWorkflowWorkspace = useWorkspaceBindingRef(workflowWorkspace);
  currentWorkflowWorkspace.current = workflowWorkspace;
  const openingWorkspace = useWorkspaceBindingRef({ cycle: targetLifecycle.cycle, id: workflowWorkspace });
  if (openingWorkspace.current.cycle !== targetLifecycle.cycle) openingWorkspace.current = { cycle: targetLifecycle.cycle, id: workflowWorkspace };
  const ownsWorkspace = () => openingWorkspace.current.id === currentWorkflowWorkspace.current;
  return { ...targetLifecycle,
    begin: () => ownsWorkspace() && targetLifecycle.begin(),
    isCurrent: () => ownsWorkspace() && targetLifecycle.isCurrent(),
    register: (dirty: boolean, reset: () => void, save: () => Promise<boolean>) => {
      targetLifecycle.register(dirty, reset, () => ownsWorkspace() ? save() : Promise.resolve(false));
    },
  };
}
