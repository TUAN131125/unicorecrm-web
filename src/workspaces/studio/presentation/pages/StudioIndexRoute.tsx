import React from "react";
import { Navigate } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function StudioIndexRoute() {
  const workspace = useWorkspaceContextSnapshot();
  const businessInformationPath = toWorkspacePath(
    workspace.workspaceKey,
    "studio",
    ROUTE_KEYS.SETTINGS_BUSINESS_INFORMATION,
  );

  return <Navigate
    replace
    to={toWorkspacePath(workspace.workspaceKey, "studio", ROUTE_KEYS.SETTINGS_QUICK_SETUP)}
    state={{
      backgroundLocation: {
        pathname: businessInformationPath,
        search: "",
        hash: "",
        state: null,
        key: "studio-index-background",
      },
    }}
  />;
}
