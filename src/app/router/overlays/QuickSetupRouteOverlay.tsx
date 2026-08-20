import React from "react";
import { useLocation, type Location } from "react-router-dom";
import { PermissionRouteGuard } from "@/components/PermissionRouteGuard";
import { parseCanonicalRoute, ROUTE_KEYS, toWorkspacePath } from "@/platform/navigation";
import { lazyRouteComponent, RouteScreenBoundary } from "@/app/router/runtime";

const QuickSetupOverlay = lazyRouteComponent(
  "StudioQuickSetupOverlay",
  () => import("@/workspaces/studio/presentation/views/QuickSetupView"),
  (module) => module.QuickSetupView,
);

interface QuickSetupRouteState {
  backgroundLocation?: Location;
}

function isValidBackground(location: Location | undefined, workspaceKey: string): location is Location {
  if (!location) return false;
  const context = parseCanonicalRoute(location.pathname);
  return context?.workspaceKey === workspaceKey
    && context.productSpace === "studio"
    && context.relativePath !== "settings/quick-setup";
}

export function resolveQuickSetupBackground(location: Location): Location {
  const context = parseCanonicalRoute(location.pathname);
  const isOpen = context?.productSpace === "studio"
    && context.relativePath === "settings/quick-setup";
  if (!isOpen || !context) return location;

  const requested = (location.state as QuickSetupRouteState | null)?.backgroundLocation;
  if (isValidBackground(requested, context.workspaceKey)) return requested;

  return {
    ...location,
    pathname: toWorkspacePath(context.workspaceKey, "studio", ROUTE_KEYS.SETTINGS_BUSINESS_INFORMATION),
    search: "",
    hash: "",
    state: null,
    key: "quick-setup-background",
  };
}

export const QuickSetupRouteOverlay: React.FC = () => {
  const location = useLocation();
  const context = parseCanonicalRoute(location.pathname);
  const isOpen = context?.productSpace === "studio"
    && context.relativePath === "settings/quick-setup";

  if (!isOpen) return null;
  return (
    <RouteScreenBoundary routeId="studio-quick-setup-overlay">
      <PermissionRouteGuard capability="studio.read">
        <QuickSetupOverlay />
      </PermissionRouteGuard>
    </RouteScreenBoundary>
  );
};
