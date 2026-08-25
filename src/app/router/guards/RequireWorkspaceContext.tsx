import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { RouteLoadingExperience } from "@/components/loading";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { loadAccessGovernance } from "@/platform/access-control/governance";
import {
  enterWorkspaceByKey,
  getWorkspaceBootstrapSnapshot,
  getWorkspaceContextSnapshot,
  isConnectedWorkspaceRuntime,
  loadWorkspaceMemberships,
  restoreSelectedWorkspaceContext,
  switchWorkspaceContext,
} from "@/platform/workspace-context";

type GateState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "select" }
  | { status: "onboard" }
  | { status: "failed"; message: string };

/**
 * RequireWorkspaceSelection + RequireWorkspaceRuntime.
 *
 * Workspace membership (GET /workspaces) is the only authority for whether the
 * account has a workspace, and the canonical entry function is the only authority
 * for whether it can be used. Deferred surfaces - Studio, WorkspaceConfiguration,
 * the access directory, Admin - are lazy and are never awaited here: CRM startup
 * depends on Auth -> Workspace membership -> Workspace bootstrap -> AccessControl
 * and nothing else.
 */
export const RequireWorkspaceContext: React.FC<React.PropsWithChildren> = ({ children }) => {
  const location = useLocation();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const [state, setState] = React.useState<GateState>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  const routeWorkspaceKey = workspaceKeyFromPath(location.pathname);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        if (!isConnectedWorkspaceRuntime()) {
          const current = getWorkspaceContextSnapshot();
          const workspace = routeWorkspaceKey && current.workspaceKey !== routeWorkspaceKey
            ? await switchWorkspaceContext(routeWorkspaceKey, controller.signal)
            : current;
          await loadAccessGovernance(workspace.workspaceId, controller.signal);
          setState({ status: "ready" });
          return;
        }

        const active = getWorkspaceBootstrapSnapshot();
        if (routeWorkspaceKey) {
          if (active?.workspace.workspaceKey !== routeWorkspaceKey) {
            await enterWorkspaceByKey(routeWorkspaceKey, controller.signal);
          }
          if (!controller.signal.aborted) setState({ status: "ready" });
          return;
        }

        if (active || await restoreSelectedWorkspaceContext(controller.signal)) {
          if (!controller.signal.aborted) setState({ status: "ready" });
          return;
        }

        const memberships = (await loadWorkspaceMemberships(controller.signal))
          .filter((membership) => membership.status === "active");
        if (controller.signal.aborted) return;
        setState({ status: memberships.length === 0 ? "onboard" : "select" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ status: "failed", message: describeGateFailure(error, vi) });
      }
    })();
    return () => controller.abort();
  }, [routeWorkspaceKey, attempt, vi]);

  if (state.status === "loading") return <RouteLoadingExperience fullScreen />;
  if (state.status === "onboard") return <Navigate to={ROUTE_KEYS.INITIAL_SETUP} replace />;
  if (state.status === "select") return <Navigate to={ROUTE_KEYS.WORKSPACE_SELECTION} replace />;
  if (state.status === "failed") {
    return (
      <WorkspaceRuntimeFailure
        message={state.message}
        retryLabel={vi ? "Thử lại" : "Try again"}
        title={vi ? "Không thể mở không gian làm việc" : "This workspace could not be opened"}
        selectLabel={vi ? "Chọn không gian làm việc khác" : "Choose another workspace"}
        onRetry={() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }}
      />
    );
  }
  return <>{children}</>;
};

const WorkspaceRuntimeFailure: React.FC<{
  title: string;
  message: string;
  retryLabel: string;
  selectLabel: string;
  onRetry: () => void;
}> = ({ title, message, retryLabel, selectLabel, onRetry }) => (
  <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
    <section role="alert" className="w-full max-w-md space-y-4 rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      <p className="crm-text-wrap text-xs leading-relaxed text-slate-600">{message}</p>
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-indigo-700"
        >
          {retryLabel}
        </button>
        <a
          href={`#${ROUTE_KEYS.WORKSPACE_SELECTION}`}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50/40"
        >
          {selectLabel}
        </a>
      </div>
    </section>
  </main>
);

function describeGateFailure(error: unknown, vi: boolean): string {
  const code = error instanceof Error ? error.message : String(error);
  if (code.startsWith("WORKSPACE_MEMBERSHIP_NOT_FOUND")) {
    return vi
      ? "Tài khoản của bạn không có quyền truy cập không gian làm việc này."
      : "Your account has no membership in this workspace.";
  }
  if (code.startsWith("WORKSPACE_MEMBERSHIP_INACTIVE") || code.includes("INACTIVE")) {
    return vi
      ? "Quyền truy cập không gian làm việc này đang bị tạm ngưng."
      : "Your access to this workspace is suspended.";
  }
  if (code.includes("ACCESS_CONTEXT_UNAVAILABLE") || code.includes("ACCESS_GOVERNANCE")) {
    return vi
      ? "Không đọc được ngữ cảnh phân quyền từ máy chủ."
      : "The authorization context could not be read from the server.";
  }
  return vi
    ? `Máy chủ không phản hồi hợp lệ khi mở không gian làm việc. (${code})`
    : `The server did not return a usable workspace runtime. (${code})`;
}

function workspaceKeyFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/w\/([^/]+)(?:\/|$)/u);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}
