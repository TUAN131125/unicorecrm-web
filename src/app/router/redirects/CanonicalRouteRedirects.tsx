import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useEffectiveShellAccess, firstAccessibleProductSpace } from "@/app/authorization";
import { usePlatformState } from "@/platform/application-state";
import {
  canonicalizeLegacyPath,
  isCanonicalRoute,
  parseCanonicalRoute,
  productSpaceHome,
} from "@/platform/navigation";

export const CanonicalRootRedirect: React.FC = () => {
  const { activeWorkspace } = usePlatformState();
  const access = useEffectiveShellAccess();
  const firstSpace = firstAccessibleProductSpace(access);
  if (!firstSpace) return <NoAccessibleProductSpace />;
  return <Navigate to={productSpaceHome(activeWorkspace.workspaceKey, firstSpace)} replace />;
};

export const LegacyCanonicalRedirect: React.FC = () => {
  const location = useLocation();
  const { activeWorkspace } = usePlatformState();

  // A canonical URL that reaches the wildcard is a genuine route miss. Do not
  // silently send it to Dashboard: that masks routing defects as a stale page.
  if (isCanonicalRoute(location.pathname)) {
    return <CanonicalRouteNotFound pathname={location.pathname} />;
  }

  if (location.pathname === "/ai-assistant") {
    return <Navigate to={productSpaceHome(activeWorkspace.workspaceKey, "crm")} replace />;
  }

  const target = canonicalizeLegacyPath(activeWorkspace.workspaceKey, location.pathname);
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
};

const CanonicalRouteNotFound: React.FC<{ pathname: string }> = ({ pathname }) => {
  const { activeWorkspace } = usePlatformState();
  const context = parseCanonicalRoute(pathname);
  const targetSpace = context?.productSpace ?? "crm";

  return (
    <div className="mx-auto mt-12 flex max-w-lg flex-col items-center rounded-2xl border border-amber-200 bg-white p-10 text-center shadow-sm" data-route-state="not-found">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600">
        <AlertTriangle size={22} />
      </div>
      <h2 className="mt-4 text-base font-extrabold text-slate-900">Không tìm thấy màn hình</h2>
      <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
        Trang này không còn tồn tại hoặc đã được chuyển. Bạn có thể quay lại trang chính để tiếp tục làm việc.
      </p>
      <code className="mt-4 max-w-full overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-600">{pathname}</code>
      <Link
        to={productSpaceHome(activeWorkspace.workspaceKey, targetSpace)}
        className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-700"
      >
        Về trang chính
      </Link>
    </div>
  );
};

const NoAccessibleProductSpace: React.FC = () => (
  <div className="mx-auto mt-12 max-w-md rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
    <h2 className="text-base font-extrabold text-slate-800">Không có khu vực làm việc khả dụng</h2>
    <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
      Tài khoản của bạn chưa được cấp quyền vào CRM, Thiết lập hoặc Người dùng & quyền. Hãy liên hệ quản trị viên.
    </p>
  </div>
);
