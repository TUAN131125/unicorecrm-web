import React from "react";
import { Building2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { productSpaceHome, ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { terminateAuthSession } from "@/platform/identity-auth";
import {
  loadWorkspaceMemberships,
  resetWorkspaceContextSelection,
  switchWorkspaceContext,
  type WorkspaceMembership,
} from "@/platform/workspace-context";
import { AuthNotice, AuthShell } from "../components";

export const WorkspaceSelectionPage: React.FC = () => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const navigate = useNavigate();
  const [memberships, setMemberships] = React.useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectingKey, setSelectingKey] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(undefined);
    try { setMemberships((await loadWorkspaceMemberships(signal)).filter((membership) => membership.status === "active")); }
    catch { if (!signal?.aborted) setError(vi ? "Không thể tải danh sách không gian làm việc." : "Unable to load workspaces."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [vi]);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const selectWorkspace = async (membership: WorkspaceMembership) => {
    setSelectingKey(membership.workspaceKey);
    setError(undefined);
    try {
      const selected = await switchWorkspaceContext(membership.workspaceKey);
      navigate(productSpaceHome(selected.workspaceKey, "crm"), { replace: true });
    } catch {
      setError(vi ? "Không thể xác minh quyền truy cập không gian làm việc này." : "Unable to verify access to this workspace.");
    } finally { setSelectingKey(undefined); }
  };

  const switchAccount = async () => {
    resetWorkspaceContextSelection();
    await terminateAuthSession("SWITCH_ACCOUNT");
    navigate(ROUTE_KEYS.LOGIN, { replace: true });
  };

  return (
    <AuthShell visualMode="neutral" title={vi ? "Chọn không gian làm việc" : "Choose a workspace"}>
      <div className="space-y-3">
        {loading && <AuthNotice tone="info">{vi ? "Đang tải không gian làm việc..." : "Loading workspaces..."}</AuthNotice>}
        {error && <AuthNotice tone="warning">{error}</AuthNotice>}
        {!loading && memberships.length === 0 && <AuthNotice tone="warning">{vi ? "Chưa có không gian làm việc khả dụng." : "No workspace is available."}</AuthNotice>}
        {memberships.map((membership) => (
          <button
            key={membership.membershipId ?? membership.workspaceId}
            type="button"
            disabled={selectingKey !== undefined}
            onClick={() => { void selectWorkspace(membership); }}
            className="group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/45 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Building2 size={19} /></span>
              <span className="min-w-0">
                <span className="block crm-text-wrap text-sm font-medium text-slate-900">{membership.name}</span>
                <span className="mt-0.5 block crm-text-wrap text-[11px] text-slate-500">{membership.workspaceKey}</span>
              </span>
            </span>
            <ChevronRight size={18} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
          </button>
        ))}
        <button type="button" onClick={() => { void switchAccount(); }} className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50/40">
          {vi ? "Dùng tài khoản khác" : "Use another account"}
        </button>
      </div>
    </AuthShell>
  );
};

export default WorkspaceSelectionPage;
