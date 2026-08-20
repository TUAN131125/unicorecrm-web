import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePlatformState } from "@/platform/application-state";
import { stripLeadingSlash, toWorkspacePath, type CanonicalProductSpace } from "@/platform/navigation";
import { ROUTE_METADATA } from "@/app/routes/routeMeta";
import { useI18n } from "@/i18n";
import { useEffectiveAccess } from "@/platform/access-control";
import { resolveGuidanceContext } from "@/guidance/application/resolveGuidanceContext";
import { FIELD_GUIDANCE_BY_KEY, SCREEN_GUIDANCE_BY_ID, WORKFLOW_GUIDANCE_BY_ID } from "@/guidance/application/guidanceRegistry";
import { readGuidanceProgress, writeGuidanceProgress } from "@/guidance/application/guidanceProgressStore";
import { hasAllCapabilities } from "@/guidance/domain/guidance.rules";
import type { GuidanceProgress, ScreenGuidance } from "@/guidance/domain/guidance.types";
import { GuidancePanel } from "./GuidancePanel";
import { GuidanceSpotlight } from "./GuidanceSpotlight";
import { GuidanceContext, type GuidanceContextValue, type GuidanceSelection } from "./GuidanceContext";

export const GuidanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { activeWorkspace, session } = usePlatformState();
  const access = useEffectiveAccess();
  const can = useCallback((capability: string) => access.can(capability), [access]);
  const resolved = useMemo(() => resolveGuidanceContext(location.pathname, can), [location.pathname, can]);
  const productSpace = resolved?.productSpace || "crm";
  const currentGuidance = resolved?.guidance;
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selection, setSelection] = useState<GuidanceSelection>(null);
  const [activeWalkthrough, setActiveWalkthrough] = useState<{ guidanceId: string; stepIndex: number }>();
  const [progress, setProgress] = useState<GuidanceProgress>(() => readGuidanceProgress(activeWorkspace.workspaceId, session.principal.memberId));

  useEffect(() => {
    setProgress(readGuidanceProgress(activeWorkspace.workspaceId, session.principal.memberId));
    setActiveWalkthrough(undefined);
  }, [activeWorkspace.workspaceId, session.principal.memberId]);

  useEffect(() => {
    if (isPanelOpen) setSelection(null);
  }, [location.pathname]);

  const updateProgress = useCallback((updater: (current: GuidanceProgress) => GuidanceProgress) => {
    setProgress((current) => {
      const next = updater(current);
      writeGuidanceProgress(activeWorkspace.workspaceId, session.principal.memberId, next);
      return next;
    });
  }, [activeWorkspace.workspaceId, session.principal.memberId]);

  const openPanel = useCallback(() => {
    setSelection(null);
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const navigateTo = useCallback((route: string, targetSpace: CanonicalProductSpace = productSpace) => {
    navigate(toWorkspacePath(activeWorkspace.workspaceKey, targetSpace, stripLeadingSlash(route)));
    setIsPanelOpen(false);
  }, [activeWorkspace.workspaceKey, navigate, productSpace]);

  const staticRouteForGuidance = useCallback((guidance: ScreenGuidance): { route: string; productSpace: CanonicalProductSpace } | null => {
    if (guidance.productSpace === "people") {
      const peopleRouteByKey: Record<string, string> = {
        SETTINGS_USERS_PERMISSIONS: "members",
        SETTINGS_ROLES: "roles",
        SETTINGS_AUDIT_LOGS: "audit",
      };
      return { route: peopleRouteByKey[guidance.routeKey] || "members", productSpace: "people" };
    }
    const meta = ROUTE_METADATA[guidance.routeKey];
    if (!meta) return null;
    const routeParts = stripLeadingSlash(meta.path).split("/");
    const dynamicIndex = routeParts.findIndex((part) => part.startsWith(":"));
    const route = dynamicIndex >= 0 ? routeParts.slice(0, dynamicIndex).join("/") : meta.path;
    return { route, productSpace: guidance.productSpace };
  }, []);

  const openScreen = useCallback((guidanceId: string) => {
    const item = SCREEN_GUIDANCE_BY_ID.get(guidanceId);
    if (!item || !hasAllCapabilities(item.requiredCapabilities, can)) return;
    const destination = staticRouteForGuidance(item);
    if (destination) navigateTo(destination.route, destination.productSpace);
  }, [can, navigateTo, staticRouteForGuidance]);

  const openWorkflow = useCallback((workflowId: string) => {
    const item = WORKFLOW_GUIDANCE_BY_ID.get(workflowId);
    if (!item) return;
    setSelection({ kind: "workflow", item });
    setIsPanelOpen(true);
  }, []);

  const openFieldHelp = useCallback((helpKey: string) => {
    const item = FIELD_GUIDANCE_BY_KEY.get(helpKey);
    if (!item) return;
    setSelection({ kind: "field", item });
    setIsPanelOpen(true);
  }, []);

  const startWalkthrough = useCallback((guidance = currentGuidance) => {
    if (!guidance?.steps?.length) return;
    const steps = guidance.steps.filter((step) => hasAllCapabilities(step.requiredCapabilities, can));
    if (steps.length === 0) return;
    const saved = progress.activeWalkthroughs[guidance.id];
    const stepIndex = saved?.version === guidance.version ? Math.min(saved.stepIndex, steps.length - 1) : 0;
    setActiveWalkthrough({ guidanceId: guidance.id, stepIndex });
    setIsPanelOpen(false);
    updateProgress((current) => ({
      ...current,
      activeWalkthroughs: {
        ...current.activeWalkthroughs,
        [guidance.id]: { version: guidance.version, stepIndex, updatedAt: new Date().toISOString() },
      },
    }));
  }, [can, currentGuidance, progress.activeWalkthroughs, updateProgress]);

  const walkthrough = useMemo(() => {
    if (!activeWalkthrough) return undefined;
    const guidance = SCREEN_GUIDANCE_BY_ID.get(activeWalkthrough.guidanceId);
    if (!guidance?.steps?.length) return undefined;
    const steps = guidance.steps.filter((step) => hasAllCapabilities(step.requiredCapabilities, can));
    if (steps.length === 0) return undefined;
    return { guidance, steps, stepIndex: Math.min(activeWalkthrough.stepIndex, steps.length - 1) };
  }, [activeWalkthrough, can]);

  const completeWalkthrough = useCallback((guidance: ScreenGuidance) => {
    setActiveWalkthrough(undefined);
    updateProgress((current) => {
      const active = { ...current.activeWalkthroughs };
      delete active[guidance.id];
      return {
        ...current,
        activeWalkthroughs: active,
        completedWalkthroughs: {
          ...current.completedWalkthroughs,
          [guidance.id]: { version: guidance.version, completedAt: new Date().toISOString() },
        },
      };
    });
  }, [updateProgress]);

  const nextStep = useCallback(() => {
    if (!walkthrough) return;
    if (walkthrough.stepIndex >= walkthrough.steps.length - 1) {
      completeWalkthrough(walkthrough.guidance);
      return;
    }
    const stepIndex = walkthrough.stepIndex + 1;
    setActiveWalkthrough({ guidanceId: walkthrough.guidance.id, stepIndex });
    updateProgress((current) => ({
      ...current,
      activeWalkthroughs: {
        ...current.activeWalkthroughs,
        [walkthrough.guidance.id]: { version: walkthrough.guidance.version, stepIndex, updatedAt: new Date().toISOString() },
      },
    }));
  }, [completeWalkthrough, updateProgress, walkthrough]);

  const previousStep = useCallback(() => {
    if (!walkthrough || walkthrough.stepIndex === 0) return;
    const stepIndex = walkthrough.stepIndex - 1;
    setActiveWalkthrough({ guidanceId: walkthrough.guidance.id, stepIndex });
    updateProgress((current) => ({
      ...current,
      activeWalkthroughs: {
        ...current.activeWalkthroughs,
        [walkthrough.guidance.id]: { version: walkthrough.guidance.version, stepIndex, updatedAt: new Date().toISOString() },
      },
    }));
  }, [updateProgress, walkthrough]);

  const skipWalkthrough = useCallback(() => {
    if (!walkthrough) return;
    setActiveWalkthrough(undefined);
    updateProgress((current) => {
      const active = { ...current.activeWalkthroughs };
      delete active[walkthrough.guidance.id];
      return { ...current, activeWalkthroughs: active };
    });
  }, [updateProgress, walkthrough]);

  const toggleChecklistItem = useCallback((checklistId: string, itemId: string) => {
    updateProgress((current) => {
      const completed = new Set(current.completedChecklistItems[checklistId] || []);
      if (completed.has(itemId)) completed.delete(itemId); else completed.add(itemId);
      return {
        ...current,
        completedChecklistItems: { ...current.completedChecklistItems, [checklistId]: [...completed] },
      };
    });
  }, [updateProgress]);

  const value = useMemo<GuidanceContextValue>(() => ({
    isPanelOpen,
    openPanel,
    closePanel,
    selection,
    setSelection,
    currentGuidance,
    productSpace,
    locale,
    can,
    navigateTo,
    openScreen,
    openWorkflow,
    openFieldHelp,
    startWalkthrough,
    walkthrough,
    nextStep,
    previousStep,
    skipWalkthrough,
    progress,
    toggleChecklistItem,
  }), [isPanelOpen, openPanel, closePanel, selection, currentGuidance, productSpace, locale, can, navigateTo, openScreen, openWorkflow, openFieldHelp, startWalkthrough, walkthrough, nextStep, previousStep, skipWalkthrough, progress, toggleChecklistItem]);

  return (
    <GuidanceContext.Provider value={value}>
      {children}
      <GuidancePanel />
      <GuidanceSpotlight />
    </GuidanceContext.Provider>
  );
};
