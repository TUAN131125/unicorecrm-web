import React, { useMemo } from "react";
import { useLocation, useRoutes, type RouteObject } from "react-router-dom";
import { usePlatformState } from "@/platform/application-state";
import { wrapRouteTreeWithScreenBoundaries } from "@/app/router/runtime";
import {
  CanonicalProductSpaceGuard,
  CanonicalSpaceIndexRedirect,
} from "./guards/CanonicalProductSpaceGuard";
import {
  CanonicalRootRedirect,
  LegacyCanonicalRedirect,
} from "./redirects/CanonicalRouteRedirects";
import { createCrmWorkspaceRoutes } from "./workspaces/crmWorkspaceRoutes";
import { createPeopleAccessWorkspaceRoutes } from "./workspaces/peopleAccessWorkspaceRoutes";
import { createStudioWorkspaceRoutes } from "./workspaces/studioWorkspaceRoutes";
import { QuickSetupRouteOverlay, resolveQuickSetupBackground } from "./overlays/QuickSetupRouteOverlay";

export const CrmRoutes: React.FC = () => {
  const { crmConfig } = usePlatformState();
  const location = useLocation();

  const routeTree = useMemo<RouteObject[]>(() => {
    const routes: RouteObject[] = [
      {
        path: "/w/:workspaceKey/crm",
        element: <CanonicalProductSpaceGuard productSpace="crm" />,
        children: [
          { index: true, element: <CanonicalSpaceIndexRedirect productSpace="crm" /> },
          ...createCrmWorkspaceRoutes(crmConfig),
        ],
      },
      {
        path: "/w/:workspaceKey/studio",
        element: <CanonicalProductSpaceGuard productSpace="studio" />,
        children: [
          ...createStudioWorkspaceRoutes(),
        ],
      },
      {
        path: "/w/:workspaceKey/people",
        element: <CanonicalProductSpaceGuard productSpace="people" />,
        children: [
          { index: true, element: <CanonicalSpaceIndexRedirect productSpace="people" /> },
          ...createPeopleAccessWorkspaceRoutes(),
        ],
      },
      { path: "/canonical-home", element: <CanonicalRootRedirect /> },
      { path: "*", element: <LegacyCanonicalRedirect /> },
    ];

    return wrapRouteTreeWithScreenBoundaries(routes, "canonical-shell");
  }, [crmConfig]);

  const primaryRoute = useRoutes(routeTree, resolveQuickSetupBackground(location));

  return (
    <>
      {primaryRoute}
      <QuickSetupRouteOverlay />
    </>
  );
};
