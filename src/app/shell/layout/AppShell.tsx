import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useBlocker, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffectiveShellAccess, firstAccessibleProductSpace } from "@/app/authorization";
import { usePlatformState } from "@/platform/application-state";
import {
  inferLegacyProductSpace,
  parseCanonicalRoute,
  productSpaceHome,
  toWorkspacePath,
  type CanonicalProductSpace,
} from "@/platform/navigation";
import { useShellPreferences } from "@/app/shell/hooks/useShellPreferences";
import { DEFAULT_CRM_WORKSPACE_CONFIG } from "@/platform/workspace-config/workspaceConfigDefaults";
import { useI18n } from "@/i18n";
import { terminateAuthSession } from "@/platform/identity-auth";
import { resetWorkspaceContextSelection } from "@/platform/workspace-context";
import { ROUTE_KEYS } from "@/platform/navigation";
import { isKnownStudioRoutePath } from "@/workspaces/studio/navigation/studioSectionRegistry";
import { CAPABILITIES } from "@/platform/access-control";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileDrawer } from "./MobileDrawer";
import { ProductDialogHost, requestDecision } from "@/components/feedback/ProductDialogService";
import { discardDirtyUnsavedWork, getDirtyUnsavedWork, getUnsavedWorkVersion, subscribeUnsavedWork } from "@/platform/unsaved-work";
import { GlobalMutationConflictHost, formatApplicationError } from "@/shared/operations";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, locale, setLocale } = useI18n();
  const {
    session,
    crmConfig = DEFAULT_CRM_WORKSPACE_CONFIG,
    activeWorkspace,
    workspaceMemberships,
    switchWorkspace,
  } = usePlatformState();
  const shellAccess = useEffectiveShellAccess();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isSidebarCollapsed, setIsSidebarCollapsed } = useShellPreferences();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const navigationMotion = useAnimationControls();
  const reduceMotion = useReducedMotion();
  const previousPathnameRef = useRef(location.pathname);
  const unsavedWorkVersion = useSyncExternalStore(subscribeUnsavedWork, getUnsavedWorkVersion, () => "");
  const bypassUnsavedBlockerRef = useRef(false);

  useLayoutEffect(() => {
    if (previousPathnameRef.current === location.pathname) return;
    previousPathnameRef.current = location.pathname;
    if (reduceMotion) return;

    navigationMotion.stop();
    navigationMotion.set({ opacity: 0.985, y: 5 });
    const frame = window.requestAnimationFrame(() => {
      void navigationMotion.start({
        opacity: 1,
        y: 0,
        transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, navigationMotion, reduceMotion]);

  const canonicalContext = parseCanonicalRoute(location.pathname);
  const activeProductSpace: CanonicalProductSpace = canonicalContext?.productSpace || inferLegacyProductSpace(location.pathname);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2500);
  };

  const handleLogout = async () => {
    resetWorkspaceContextSelection();
    await terminateAuthSession("USER_SIGN_OUT");
    navigate(ROUTE_KEYS.LOGIN, { replace: true });
  };

  const currentUser = {
    id: session.principal.memberId,
    name: session.principal.displayName,
    email: session.principal.email,
    avatarUrl: "",
  };


  const canPreserveEquivalentRoute = (
    space: CanonicalProductSpace,
    relativePath: string,
  ): boolean => {
    const firstSegment = relativePath.split("/").filter(Boolean)[0] || "";

    if (space === "crm") {
      const workspaceUtilityRoutes = new Set(["dashboard", "calendar", "notifications", "reports"]);
      if (workspaceUtilityRoutes.has(firstSegment)) return shellAccess.canAccessModule("dashboard");

      const moduleBySegment: Record<string, string> = {
        leads: "leads",
        contacts: "contacts",
        organizations: "organizations",
        customers: "customers",
        deals: "deals",
        quotes: "quotes",
        orders: "orders",
        products: "products",
        payments: "payments",
        invoices: "invoices",
        receivables: "receivables",
        shipping: "shipping",
        returns: "returns",
        support: "support",
        tasks: "tasks",
      };
      const moduleKey = moduleBySegment[firstSegment];
      if (!moduleKey || !shellAccess.canAccessModule(moduleKey)) return false;
      const enabledModules: Partial<Record<string, boolean>> = crmConfig.modules || {};
      const moduleFlagByKey: Record<string, string> = {
        leads: "leads", contacts: "contacts", organizations: "organizations", customers: "customers", deals: "deals", quotes: "quotes",
        orders: "orders", products: "products", payments: "payments", invoices: "invoices", receivables: "invoices", shipping: "shipping", returns: "returns", support: "support", tasks: "tasks",
      };
      const flag = moduleFlagByKey[moduleKey];
      return !flag || enabledModules[flag] !== false;
    }

    if (space === "studio") {
      if (relativePath === "settings/ai") return shellAccess.can(CAPABILITIES.AI_CONFIGURATION_READ);
      return isKnownStudioRoutePath(relativePath) && shellAccess.canAccessModule("systemConfiguration");
    }

    const peopleModuleBySegment: Record<string, string> = {
      members: "usersPermissions",
      roles: "usersPermissions",
      audit: "auditLogs",
    };
    const moduleKey = peopleModuleBySegment[firstSegment];
    return !!moduleKey && shellAccess.canAccessModule(moduleKey);
  };

  const navigateProductSpace = (space: CanonicalProductSpace) => {
    if (!shellAccess.productSpaces.has(space)) return;
    navigate(productSpaceHome(activeWorkspace.workspaceKey, space));
  };

  const handleWorkspaceSwitch = async (workspaceKey: string) => {
    if (workspaceKey === activeWorkspace.workspaceKey) return;

    const dirtyEntries = getDirtyUnsavedWork();
    if (dirtyEntries.length > 0) {
      const decision = await requestDecision(unsavedNavigationDecision(locale));
      if (decision !== "discard" || !discardDirtyUnsavedWork()) return;
    }

    const currentContext = parseCanonicalRoute(location.pathname);
    const targetSpace = currentContext?.productSpace && shellAccess.productSpaces.has(currentContext.productSpace)
      ? currentContext.productSpace
      : firstAccessibleProductSpace(shellAccess);

    if (!targetSpace) {
      showToast("Bạn không có quyền truy cập khu vực nào trong không gian làm việc này.");
      return;
    }

    try {
      await switchWorkspace(workspaceKey);
    } catch (caught) {
      // Workspace entry retires the previous scope before resolving the next one. Re-enter
      // through the authoritative boundary so a refused switch never reuses stale projections.
      let restored = false;
      try { await switchWorkspace(activeWorkspace.workspaceKey); restored = true; } catch { /* Selection must resolve access again. */ }
      await requestDecision({
        title: locale === "vi" ? "Không thể chuyển không gian làm việc" : "Could not switch workspace",
        message: formatApplicationError(caught, { locale }),
        actions: [{ id: "close", label: locale === "vi" ? "Tiếp tục" : "Continue", variant: "primary" }],
        tone: "warning",
      });
      bypassUnsavedBlockerRef.current = true;
      navigate(restored ? productSpaceHome(activeWorkspace.workspaceKey, targetSpace) : ROUTE_KEYS.WORKSPACE_SELECTION, { replace: true });
      window.setTimeout(() => { bypassUnsavedBlockerRef.current = false; }, 0);
      return;
    }
    bypassUnsavedBlockerRef.current = true;
    const canKeepEquivalentRoute = !!currentContext?.relativePath
      && currentContext.productSpace === targetSpace
      && canPreserveEquivalentRoute(targetSpace, currentContext.relativePath);
    const equivalentPath = canKeepEquivalentRoute
      ? toWorkspacePath(workspaceKey, targetSpace, currentContext.relativePath)
      : productSpaceHome(workspaceKey, targetSpace);
    navigate(equivalentPath, { replace: true });
    window.setTimeout(() => { bypassUnsavedBlockerRef.current = false; }, 0);
  };

  return (
    <div id="unicore-root" className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
        <UnsavedNavigationGuard
          locale={locale}
          bypassRef={bypassUnsavedBlockerRef}
          version={unsavedWorkVersion}
        />
      <MobileDrawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <Sidebar
        crmConfig={crmConfig}
        shellAccess={shellAccess}
        activeProductSpace={activeProductSpace}
        activeWorkspace={activeWorkspace}
        workspaceMemberships={workspaceMemberships}
        onWorkspaceSwitch={handleWorkspaceSwitch}
        isSidebarCollapsed={isSidebarCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        showToast={showToast}
        t={t}
        locale={locale}
      />

      <div className="relative flex-1 flex h-screen flex-col overflow-hidden min-w-0">
        <TopBar
          activeProductSpace={activeProductSpace}
          accessibleProductSpaces={shellAccess.productSpaces}
          activeWorkspaceKey={activeWorkspace.workspaceKey}
          onNavigateProductSpace={navigateProductSpace}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          t={t}
          locale={locale}
          setLocale={setLocale}
          currentUser={currentUser}
          onProfile={() => navigate(toWorkspacePath(activeWorkspace.workspaceKey, "people", "members"))}
          onPreference={() => showToast("Thiết lập cá nhân chưa khả dụng. Hãy thử lại sau.")}
          onSecurity={() => navigate(toWorkspacePath(activeWorkspace.workspaceKey, "people", "audit"))}
          onSessions={() => navigate(toWorkspacePath(activeWorkspace.workspaceKey, "people", "audit"))}
          handleLogout={handleLogout}
        />

        <main
          key={activeWorkspace.workspaceKey}
          className="crm-app-scroll flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 min-h-0"
          data-workspace-key={activeWorkspace.workspaceKey}
          data-product-space={activeProductSpace}
          data-router-pathname={location.pathname}
        >
          <motion.div
            initial={false}
            animate={navigationMotion}
            className="min-h-full w-full"
            data-route-content="stable"
            data-guidance-id="shell.route-content"
            data-navigation-motion="v2"
            style={{ willChange: reduceMotion ? undefined : "transform, opacity" }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <ProductDialogHost />
      <GlobalMutationConflictHost />

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-xl flex items-center gap-2.5 max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const UnsavedNavigationGuard: React.FC<{
  locale: "vi" | "en";
  bypassRef: { current: boolean };
  version: string;
}> = ({ locale, bypassRef, version }) => {
  const blocker = useBlocker(() => !bypassRef.current && getDirtyUnsavedWork().length > 0);
  const decisionOpenRef = useRef(false);

  useEffect(() => {
    if (blocker.state !== "blocked" || decisionOpenRef.current) return;
    decisionOpenRef.current = true;
    // Read the registry after this commit's effect cleanups and registrations settle.
    // A target-bound form can replace its entry during the same passive-effect flush.
    void Promise.resolve().then(() => requestDecision(unsavedNavigationDecision(locale))).then((decision) => {
      if (blocker.state !== "blocked") return;
      if (decision === "discard" && discardDirtyUnsavedWork()) blocker.proceed();
      else blocker.reset();
    }).finally(() => { decisionOpenRef.current = false; });
  }, [blocker, locale, version]);

  return null;
};

function unsavedNavigationDecision(locale: "vi" | "en") {
  const vi = locale === "vi";
  const canDiscard = getDirtyUnsavedWork().every(entry => entry.canDiscard?.() !== false);
  return {
    title: canDiscard
      ? (vi ? "Bỏ các thay đổi chưa lưu?" : "Discard unsaved changes?")
      : (vi ? "Thao tác chưa hoàn tất" : "Operation not completed"),
    message: canDiscard
      ? (vi ? "Nội dung bạn vừa nhập sẽ không được lưu." : "Your changes will not be saved.")
      : (vi ? "Hãy chờ hoặc tiếp tục kiểm tra kết quả trước khi rời trang. Đóng trang lúc này có thể làm mất khả năng tiếp tục thao tác." : "Wait or check the result before leaving. Leaving now may prevent you from resuming this operation."),
    tone: "warning" as const,
    actions: [
      { id: "stay", label: vi ? "Tiếp tục chỉnh sửa" : "Keep editing", variant: "secondary" as const },
      ...(canDiscard ? [{ id: "discard", label: vi ? "Bỏ thay đổi" : "Discard changes", variant: "warning" as const }] : []),
    ],
  };
}
