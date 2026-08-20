import React, { Suspense, useState } from "react";
import { useLocation } from "react-router-dom";
import { useEffectiveShellAccess } from "@/app/authorization";
import { parseCanonicalRoute } from "@/platform/navigation";
import { CrmRoutes } from "@/app/router/CrmRoutes";
import { AiAssistantButton } from "@/components/ai/AiAssistantButton";
import { useGlobalAiContext } from "@/workspaces/crm/ai-context";
import { AppShell } from "./layout/AppShell";
import { useFloatingUtilityLayout } from "@/components/ai/useFloatingUtilityLayout";

const AiAssistantDrawer = React.lazy(() => import("@/components/ai/AiAssistantDrawer").then((module) => ({ default: module.AiAssistantDrawer })));

export const CrmApplicationShell: React.FC = () => {
  const location = useLocation();
  const routeContext = parseCanonicalRoute(location.pathname);
  const shellAccess = useEffectiveShellAccess();
  const showCrmAi =
    routeContext?.productSpace === "crm" &&
    shellAccess.productSpaces.has("crm");

  return (
    <AppShell>
      <CrmRoutes />
      {showCrmAi && <CrmAiFloatingUtility pathname={location.pathname} />}
    </AppShell>
  );
};

const CrmAiFloatingUtility: React.FC<{ pathname: string }> = ({ pathname }) => {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const aiContext = useGlobalAiContext(pathname);
  useFloatingUtilityLayout(pathname);

  return (
    <>
      <AiAssistantButton onClick={() => setIsAiOpen(true)} />
      {isAiOpen && <Suspense fallback={null}><AiAssistantDrawer
          isOpen
          onClose={() => setIsAiOpen(false)}
          context={aiContext}
        /></Suspense>}
    </>
  );
};
