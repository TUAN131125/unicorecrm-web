import React from "react";
import { Navigate } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";
import { ROUTE_KEYS } from "@/platform/navigation";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { shouldAutoOpenQuickSetup } from "../../application/quickSetup.types";
import { useQuickSetupState } from "../hooks/useQuickSetupState";

export function StudioIndexRoute() {
  const workspace = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  const state = useQuickSetupState();
  const autoOpen = shouldAutoOpenQuickSetup(state, access.can(CAPABILITIES.STUDIO_CONFIGURE));
  const businessInformationPath = toWorkspacePath(
    workspace.workspaceKey,
    "studio",
    ROUTE_KEYS.SETTINGS_BUSINESS_INFORMATION,
  );

  return <Navigate
    replace
    to={autoOpen
      ? toWorkspacePath(workspace.workspaceKey, "studio", ROUTE_KEYS.SETTINGS_QUICK_SETUP)
      : businessInformationPath}
    state={autoOpen ? {
      backgroundLocation: {
        pathname: businessInformationPath,
        search: "",
        hash: "",
        state: null,
        key: "studio-index-background",
      },
    } : undefined}
  />;
}
