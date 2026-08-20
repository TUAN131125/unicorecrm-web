import React from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffectiveAccess, type Capability } from "@/platform/access-control";
import { usePlatformState } from "@/platform/application-state";
import { productSpaceHome } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { ListStatePanel } from "@/components/crm/list-archetype";
import { ReadOnlyAccessBanner } from "@/components/access/ReadOnlyAccessBanner";
import { canWriteModule, moduleAccessPolicy } from "@/platform/access-control/domain/moduleAccessPolicy";

interface PermissionRouteGuardProps {
  moduleKey?: string;
  capability?: Capability;
  children: React.ReactNode;
}

export const PermissionRouteGuard: React.FC<PermissionRouteGuardProps> = ({ moduleKey, capability, children }) => {
  const { t, locale } = useI18n();
  const { activeWorkspace } = usePlatformState();
  const access = useEffectiveAccess();
  const allowed = capability ? access.can(capability) : moduleKey ? access.canAccessModule(moduleKey) : false;

  if (!allowed) {
    return (
      <div id="permission-denied-route-view" data-access-state="permission-denied" className="mx-auto mt-8 w-full max-w-3xl">
        <ListStatePanel
          kind="permission"
          title={t("permissions.denied.title")}
          action={
            <Link
              to={productSpaceHome(activeWorkspace.workspaceKey, "crm")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-indigo-700"
            >
              <ArrowLeft size={12} />
              <span>{locale === "vi" ? "Về Trang chủ CRM" : "Back to CRM home"}</span>
            </Link>
          }
        />
      </div>
    );
  }

  const policy = moduleKey ? moduleAccessPolicy(moduleKey) : undefined;
  const readOnly = Boolean(moduleKey && policy?.showReadOnlyBanner && !canWriteModule(access, moduleKey));

  if (readOnly && moduleKey) {
    return (
      <div data-module-key={moduleKey} data-access-mode="read-only">
        <ReadOnlyAccessBanner moduleKey={moduleKey} />
        {children}
      </div>
    );
  }

  return <div data-module-key={moduleKey} data-access-mode="read-write">{children}</div>;
};
