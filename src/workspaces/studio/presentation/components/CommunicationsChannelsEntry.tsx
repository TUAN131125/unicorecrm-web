import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { toWorkspacePath } from "@/platform/navigation";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export function CommunicationsChannelsEntry() {
  const { locale } = useI18n();
  const workspace = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();
  const vi = locale === "vi";
  const canManage = access.can(CAPABILITIES.COMMUNICATIONS_CHANNELS_MANAGE);

  return (
    <section className="m-6 rounded-xl border bg-white p-4" data-guidance-id="studio.integrations.communications">
      <h2 className="font-semibold">{vi ? "Communications · Kênh kết nối" : "Communications · Channel connections"}</h2>
      {canManage ? (
        <Link className="mt-2 inline-block text-indigo-700 underline" to={toWorkspacePath(workspace.workspaceKey, "studio", "settings/communications/channels")}>
          {vi ? "Quản lý nhiều tài khoản" : "Manage multiple accounts"}
        </Link>
      ) : (
        <p className="mt-2 text-sm text-slate-600" role="status">
          {vi ? "Bạn chưa có quyền quản lý kênh kết nối. Hãy liên hệ quản trị viên Workspace để được cấp quyền phù hợp." : "You do not have permission to manage channels. Contact your Workspace administrator for the required access."}
        </p>
      )}
    </section>
  );
}
