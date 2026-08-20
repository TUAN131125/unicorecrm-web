import React, { Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { productSpaceHome, parseCanonicalRoute } from "@/platform/navigation";
import { LazyRouteErrorBoundary } from "@/components/LazyRouteErrorBoundary";
import { RouteLoadingExperience } from "@/components/loading";

interface RouteScreenBoundaryProps {
  routeId: string;
  children: React.ReactNode;
}

const RouteLoadingFallback: React.FC<{ pathname: string }> = ({ pathname }) => (
  <div data-loading-pathname={pathname}>
    <RouteLoadingExperience pathname={pathname} />
  </div>
);

export const RouteScreenBoundary: React.FC<RouteScreenBoundaryProps> = ({ routeId, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const resetKey = `${routeId}:${location.pathname}`;
  const canonicalContext = parseCanonicalRoute(location.pathname);
  const recoveryPath = canonicalContext
    ? productSpaceHome(canonicalContext.workspaceKey, canonicalContext.productSpace)
    : "/canonical-home";

  return (
    <LazyRouteErrorBoundary key={resetKey} routeId={routeId} onGoHome={() => navigate(recoveryPath, { replace: true })}>
      <Suspense fallback={<RouteLoadingFallback pathname={location.pathname} />}>
        {children}
      </Suspense>
    </LazyRouteErrorBoundary>
  );
};
