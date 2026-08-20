import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { consumeAuthBoundaryReason, getAuthSessionSnapshot } from "@/platform/identity-auth";
import { ROUTE_KEYS } from "@/platform/navigation";
import { withRedirectQuery } from "@/features/auth/routing/postLoginRedirect";

interface RequireAuthProps {
  children: React.ReactElement;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const location = useLocation();
  const session = getAuthSessionSnapshot();

  if (!session || session.status !== "ACTIVE") {
    const fromPath = location.pathname + location.search;
    const boundaryReason = consumeAuthBoundaryReason();
    if (boundaryReason === "SESSION_EXPIRED") {
      return <Navigate to={withRedirectQuery(ROUTE_KEYS.SESSION_EXPIRED, fromPath)} replace />;
    }
    return <Navigate to={withRedirectQuery(ROUTE_KEYS.LOGIN, fromPath)} replace />;
  }

  return children;
};
