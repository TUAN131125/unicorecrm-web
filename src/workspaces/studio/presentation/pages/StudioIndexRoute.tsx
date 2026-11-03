import React from "react";
import { Navigate } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { shouldAutoOpenQuickSetup } from "../../application/quickSetup.types";
import { useQuickSetupState } from "../hooks/useQuickSetupState";

export function StudioIndexRoute() {
  const workspace = useWorkspaceContextSnapshot();
  const quickSetup = useQuickSetupState();
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const businessInformationPath = toWorkspacePath(
    workspace.workspaceKey,
    "studio",
    ROUTE_KEYS.SETTINGS_BUSINESS_INFORMATION,
  );

  if (!shouldAutoOpenQuickSetup(quickSetup, canConfigure)) {
    return <Navigate replace to={businessInformationPath} />;
  }

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
