import React, { useEffect } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { ShieldAlert, Building2 } from "lucide-react";
import { useEffectiveShellAccess } from "@/app/authorization";
import { usePlatformState } from "@/platform/application-state";
import {
  productSpaceHome,
  type CanonicalProductSpace,
} from "@/platform/navigation";

interface CanonicalProductSpaceGuardProps {
  productSpace: CanonicalProductSpace;
}

export const CanonicalProductSpaceGuard: React.FC<CanonicalProductSpaceGuardProps> = ({
  productSpace,
}) => {
  const { workspaceKey } = useParams<{ workspaceKey: string }>();
  const {
    activeWorkspace,
    workspaceMemberships,
    switchWorkspace,
  } = usePlatformState();
  const access = useEffectiveShellAccess();

  const membership = workspaceMemberships.find(
    (candidate) => candidate.workspaceKey === workspaceKey,
  );

  useEffect(() => {
    if (!membership || membership.status !== "active") return;
    if (activeWorkspace.workspaceKey !== membership.workspaceKey) {
      void switchWorkspace(membership.workspaceKey);
    }
  }, [activeWorkspace.workspaceKey, membership, switchWorkspace]);

  if (!workspaceKey || !membership) {
    return (
      <ContextAccessState
        icon={<Building2 size={24} />}
        title="Không gian làm việc không khả dụng"
        description="Liên kết này không thuộc không gian làm việc mà tài khoản hiện tại có quyền truy cập."
      />
    );
  }

  if (membership.status !== "active") {
    return (
      <ContextAccessState
        icon={<ShieldAlert size={24} />}
        title="Quyền truy cập đã bị tạm ngưng"
        description="Tài khoản của bạn hiện chưa thể truy cập không gian làm việc này. Hãy liên hệ quản trị viên."
      />
    );
  }

  if (!access.productSpaces.has(productSpace)) {
    return (
      <ContextAccessState
        icon={<ShieldAlert size={24} />}
        title="Bạn không có quyền truy cập khu vực này"
        description="Hãy yêu cầu quản trị viên cấp quyền phù hợp nếu bạn cần sử dụng khu vực này."
      />
    );
  }

  if (activeWorkspace.workspaceKey !== membership.workspaceKey) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          <span>Đang chuyển không gian làm việc...</span>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export const CanonicalSpaceIndexRedirect: React.FC<{
  productSpace: CanonicalProductSpace;
}> = ({ productSpace }) => {
  const { workspaceKey } = useParams<{ workspaceKey: string }>();
  if (!workspaceKey) return null;
  return <Navigate to={productSpaceHome(workspaceKey, productSpace)} replace />;
};

const ContextAccessState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="mx-auto mt-12 flex max-w-md flex-col items-center justify-center space-y-4 rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-500">
      {icon}
    </div>
    <h2 className="text-base font-extrabold text-slate-800">{title}</h2>
    <p className="text-xs font-medium leading-relaxed text-slate-500">{description}</p>
  </div>
);
