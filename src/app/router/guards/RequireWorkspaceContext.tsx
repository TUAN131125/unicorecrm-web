import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { RouteLoadingExperience } from "@/components/loading";
import { ROUTE_KEYS } from "@/platform/navigation";
import { loadAccessGovernance } from "@/platform/access-control/governance";
import { loadStudioCoreRuntime } from "@/workspaces/studio";
import {
  getWorkspaceBootstrapSnapshot,
  getWorkspaceContextSnapshot,
  isConnectedWorkspaceRuntime,
  loadWorkspaceMemberships,
  restoreSelectedWorkspaceContext,
  switchWorkspaceContext,
} from "@/platform/workspace-context";

export const RequireWorkspaceContext: React.FC<React.PropsWithChildren> = ({ children }) => {
  const location = useLocation();
  const [state, setState] = React.useState<"loading" | "ready" | "unavailable">("loading");

  React.useEffect(() => {
    const controller = new AbortController();
    const routeWorkspaceKey = workspaceKeyFromPath(location.pathname);
    void (async () => {
      try {
        if (!isConnectedWorkspaceRuntime()) {
          const current = getWorkspaceContextSnapshot();
          const workspace = routeWorkspaceKey && current.workspaceKey !== routeWorkspaceKey
            ? await switchWorkspaceContext(routeWorkspaceKey, controller.signal)
            : current;
          await loadAccessGovernance(workspace.workspaceId, controller.signal);
          setState("ready");
          return;
        }
        const active = getWorkspaceBootstrapSnapshot();
        if (routeWorkspaceKey) {
          if (active?.workspace.workspaceKey !== routeWorkspaceKey) await switchWorkspaceContext(routeWorkspaceKey, controller.signal);
          const context = getWorkspaceBootstrapSnapshot();
          if (!context) throw new Error("WORKSPACE_CONTEXT_NOT_RESOLVED");
          await Promise.all([
            loadAccessGovernance(context.workspace.workspaceId, controller.signal),
            loadStudioCoreRuntime(controller.signal),
          ]);
          setState("ready");
          return;
        }
        const restored = active || await restoreSelectedWorkspaceContext(controller.signal);
        if (restored) {
          await Promise.all([
            loadAccessGovernance(restored.workspace.workspaceId, controller.signal),
            loadStudioCoreRuntime(controller.signal),
          ]);
          setState("ready");
          return;
        }
        await loadWorkspaceMemberships(controller.signal);
        setState("unavailable");
      } catch {
        if (!controller.signal.aborted) setState("unavailable");
      }
    })();
    return () => controller.abort();
  }, [location.pathname]);

  if (state === "loading") return <RouteLoadingExperience fullScreen />;
  if (state === "unavailable") return <Navigate to={ROUTE_KEYS.WORKSPACE_SELECTION} replace />;
  return <>{children}</>;
};

function workspaceKeyFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/w\/([^/]+)(?:\/|$)/u);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}
