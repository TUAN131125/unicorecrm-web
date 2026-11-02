import React from "react";
import { Archive, ArrowLeft, Cable, CircleOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import type { WorkspaceCapabilityEntry } from "@/platform/capability-manifest";
import { ExternalAuthorityHealthPanel } from "@/platform/external-authority";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { toWorkspacePath } from "@/platform/navigation";
import { ROUTE_KEYS } from "@/platform/navigation";

interface CapabilityUnavailableStateProps {
  entry: WorkspaceCapabilityEntry;
}

export const CapabilityUnavailableState: React.FC<CapabilityUnavailableStateProps> = ({ entry }) => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const workspace = useWorkspaceContextSnapshot();
  const content = entry.mode === "EXTERNAL"
    ? {
        icon: <Cable size={26} />,
        title: vi ? "Nghiệp vụ do hệ thống bên ngoài quản lý" : "This capability is managed externally",
        description: vi
          ? "Chưa thể mở nội dung này. Liên hệ quản trị viên để được hỗ trợ."
          : "This content cannot be opened. Contact your administrator for help.",
      }
    : entry.mode === "HISTORICAL_ONLY"
      ? {
          icon: <Archive size={26} />,
          title: vi ? "Chỉ giữ dữ liệu lịch sử" : "Historical records only",
          description: vi
            ? "Bạn có thể xem lịch sử; hiện chưa thể tạo giao dịch mới."
            : "You can review historical records; new transactions are currently unavailable.",
        }
      : {
          icon: <CircleOff size={26} />,
          title: vi ? "Module chưa được bật" : "Module is not enabled",
          description: vi
            ? "Quản trị viên workspace cần cấp quyền hoặc bật tính năng phù hợp cho workspace."
            : "A workspace administrator must grant access or enable the appropriate workspace feature.",
        };

  return (
    <div
      id="capability-unavailable-view"
      data-capability-key={entry.key}
      data-capability-mode={entry.mode}
      className="mx-auto mt-10 flex w-full max-w-2xl flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">{content.icon}</div>
      <h2 className="crm-text-wrap mt-4 max-w-full break-words text-base font-extrabold text-slate-900 [overflow-wrap:anywhere]">{content.title}</h2>
      <p className="crm-text-wrap mt-2 max-w-xl break-words text-xs font-medium leading-6 text-slate-500 [overflow-wrap:anywhere]">{content.description}</p>
      {entry.mode === "EXTERNAL" && <ExternalAuthorityHealthPanel capabilityKey={entry.key} />}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to={toWorkspacePath(workspace.workspaceKey, "crm", "dashboard")} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-700">
          <ArrowLeft size={13} /> {vi ? "Về Dashboard" : "Back to dashboard"}
        </Link>
        <Link to={toWorkspacePath(workspace.workspaceKey, "studio", ROUTE_KEYS.SETTINGS_FEATURE_USAGE)} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100">
          {vi ? "Mở cấu hình CRM" : "Open CRM configuration"}
        </Link>
      </div>
    </div>
  );
};
