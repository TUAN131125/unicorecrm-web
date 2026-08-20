import React from "react";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { CapabilityUnavailableState } from "./CapabilityUnavailableState";
import { buildWorkspaceCapabilityManifest, type WorkspaceCapabilityKey } from "@/platform/capability-manifest";
import { useWorkspaceConfigSnapshot } from "@/platform/workspace-config";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { productSpaceHome } from "@/platform/navigation";

interface ModuleGuardProps {
  enabled: boolean;
  moduleKey?: WorkspaceCapabilityKey;
  children: React.ReactNode;
}

export const ModuleGuard: React.FC<ModuleGuardProps> = ({ enabled, moduleKey, children }) => {
  const { t } = useI18n();
  const workspace = useWorkspaceContextSnapshot();
  const crmConfig = useWorkspaceConfigSnapshot();
  const entry = moduleKey ? buildWorkspaceCapabilityManifest(crmConfig).entries[moduleKey] : undefined;

  if (!enabled) {
    if (entry) return <CapabilityUnavailableState entry={entry} />;
    return (
      <div id="module-action-disabled-view" className="mx-auto mt-12 flex max-w-md flex-col items-center space-y-4 rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-500"><AlertCircle size={24} /></div>
        <h2 className="text-base font-extrabold text-slate-800">{t("common.moduleDisabledTitle")}</h2>
        <p className="text-xs font-medium leading-relaxed text-slate-500">{t("common.moduleDisabledDescription")}</p>
        <div className="flex items-center gap-2 pt-2">
          <Link to={productSpaceHome(workspace.workspaceKey, "crm")} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700">{t("common.backToDashboard")}</Link>
          <Link to={productSpaceHome(workspace.workspaceKey, "studio")} className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">{t("common.openCrmConfiguration")}</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
