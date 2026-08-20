import React from "react";
import { Navigate } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export const MyWorkPage: React.FC = () => {
  const workspace = useWorkspaceContextSnapshot();
  return <Navigate to={`${toWorkspacePath(workspace.workspaceKey, "crm", "tasks")}?view=mine`} replace />;
};
