import React from "react";
import type { RouteObject } from "react-router-dom";
import { lazyRouteComponent } from "@/app/router/runtime";
import { PermissionRouteGuard } from "@/components/PermissionRouteGuard";

const UsersPermissionsPage = lazyRouteComponent("UsersPermissionsPage", () => import("@/workspaces/people-access/members"), (m) => m.UsersPermissionsPage);
const AuditLogsPage = lazyRouteComponent("AuditLogsPage", () => import("@/workspaces/people-access/audit"), (m) => m.AuditLogsPage);

const permitted = (moduleKey: string, element: React.ReactElement) => (
  <PermissionRouteGuard moduleKey={moduleKey}>{element}</PermissionRouteGuard>
);

export function createPeopleAccessWorkspaceRoutes(): RouteObject[] {
  return [
    { path: "members", element: permitted("usersPermissions", <UsersPermissionsPage />) },
    { path: "roles", element: permitted("usersPermissions", <UsersPermissionsPage />) },
    { path: "audit", element: permitted("auditLogs", <AuditLogsPage />) },
  ];
}
