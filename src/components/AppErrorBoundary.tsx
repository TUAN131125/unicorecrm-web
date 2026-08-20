import { Component, ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Top-level App Crash:", error, errorInfo);
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    try {
      [
        "unicore_auth_session_v2",
        "centrix_auth_session_v1",
        "centrix_admin_users_permissions_v2",
        "centrix_admin_users_permissions_v1",
        "unicore_active_workspace_key_v2",
        "unicore_active_workspace_key_v1",
      ].forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      console.error(e);
    }

    const basePath = `${window.location.origin}${window.location.pathname}`;
    window.location.replace(`${basePath}#/login`);
  };

  public render() {
    if (this.state.hasError) {
      // Basic language check independent of external libraries to ensure it works even if context/libs crashed.
      const isVi = document.documentElement.lang === "vi" || window.location.hash.includes("/vi") || window.location.pathname.includes("/vi");

      return (
        <div className="w-screen h-screen flex items-center justify-center p-6 bg-slate-50 font-sans">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center space-y-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
              <svg 
                className="w-6 h-6 text-rose-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
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
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {isVi ? "Không thể tải ứng dụng" : "Could not load application"}
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {isVi 
                  ? "Ứng dụng gặp lỗi khi khởi tạo. Hãy làm mới trang; nếu lỗi tiếp diễn, hãy đăng xuất phiên demo rồi đăng nhập lại." 
                  : "The application failed during startup. Refresh the page; if the issue continues, sign out of the demo session and sign in again."}
              </p>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleRefresh}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                {isVi ? "Làm mới" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={this.handleClearAndReload}
                className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                {isVi ? "Đăng xuất phiên demo" : "Sign out of demo session"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
