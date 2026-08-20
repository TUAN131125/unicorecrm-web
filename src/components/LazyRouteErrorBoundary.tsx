import React, { Component, type ErrorInfo, type ReactNode } from "react";
import {
  classifyRouteScreenError,
  type RouteScreenErrorKind,
} from "@/app/router/runtime/routeScreenErrors";

interface Props {
  children: ReactNode;
  routeId?: string;
  onGoHome?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  kind: RouteScreenErrorKind | null;
}

interface ErrorCopy {
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
}

const ERROR_COPY: Record<RouteScreenErrorKind, ErrorCopy> = {
  MODULE_LOAD: {
    titleVi: "Không thể tải mô-đun màn hình.",
    titleEn: "The screen module could not be loaded.",
    descriptionVi: "Mô-đun giao diện chưa tải được. Hãy làm mới trang; nếu lỗi vẫn còn, quay lại workspace và thử lại sau.",
    descriptionEn: "The interface module did not load. Refresh the page; if the problem continues, return to the workspace and try again later.",
  },
  CONFIGURATION: {
    titleVi: "Cấu hình màn hình không hợp lệ.",
    titleEn: "The screen configuration is invalid.",
    descriptionVi: "Studio không thể đọc cấu hình cần thiết cho màn hình này. Hãy thử tải lại phần cấu hình hoặc quay lại workspace.",
    descriptionEn: "Studio could not read the configuration required by this screen. Retry the configuration load or return to the workspace.",
  },
  RENDER: {
    titleVi: "Màn hình gặp lỗi khi hiển thị.",
    titleEn: "The screen encountered a rendering error.",
    descriptionVi: "Logic giao diện đã dừng để bảo vệ phiên làm việc. Hãy thử hiển thị lại màn hình hoặc quay lại workspace.",
    descriptionEn: "The interface stopped to protect the current session. Retry the screen or return to the workspace.",
  },
};

export class LazyRouteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    kind: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      kind: classifyRouteScreenError(error),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught route screen error:", {
      routeId: this.props.routeId ?? "unknown",
      kind: classifyRouteScreenError(error),
      error,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleRefresh = (): void => {
    window.location.reload();
  };

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null, kind: null });
  };

  private handleGoHome = (): void => {
    if (this.props.onGoHome) {
      this.props.onGoHome();
      return;
    }
    window.location.reload();
  };

  public render(): ReactNode {
    if (!this.state.hasError || !this.state.kind) return this.props.children;

    const isVi = document.documentElement.lang === "vi" || window.location.pathname.includes("/vi");
    const copy = ERROR_COPY[this.state.kind];
    const primaryAction = this.state.kind === "MODULE_LOAD" ? this.handleRefresh : this.handleRetry;
    const primaryLabel = this.state.kind === "MODULE_LOAD"
      ? (isVi ? "Làm mới trang" : "Refresh page")
      : (isVi ? "Thử lại" : "Try again");

    return (
      <div
        className="flex min-h-[400px] w-full items-center justify-center bg-slate-50/50 p-6"
        data-route-error-kind={this.state.kind}
        data-route-error-id={this.props.routeId ?? "unknown"}
      >
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rose-100 bg-rose-50">
            <svg
              className="h-6 w-6 text-rose-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold tracking-tight text-slate-800">
              {isVi ? copy.titleVi : copy.titleEn}
            </h3>
            <p className="text-xs font-medium leading-relaxed text-slate-500">
              {isVi ? copy.descriptionVi : copy.descriptionEn}
            </p>
            <p className="text-[11px] text-slate-400">
              {isVi ? "Tham chiếu" : "Reference"}: {this.props.routeId ?? "route-screen"}
            </p>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={primaryAction}
              className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
            >
              {isVi ? "Về workspace" : "Back to workspace"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
