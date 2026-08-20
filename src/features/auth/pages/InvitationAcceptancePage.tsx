import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { productSpaceHome } from "@/platform/navigation";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { acceptWorkspaceInvitation, getAuthSessionSnapshot } from "@/platform/identity-auth";
import { DEVELOPMENT_WORKSPACES } from "@/platform/workspace-membership";
import { AuthNotice, AuthPrimaryButton, AuthShell } from "../components";

export const InvitationAcceptancePage: React.FC = () => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const session = getAuthSessionSnapshot();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await acceptWorkspaceInvitation(token);
      if (response.ok === false) {
        setError(vi ? "Lời mời không hợp lệ hoặc đã hết hạn." : "The invitation is invalid or expired.");
        return;
      }
      const workspace = DEVELOPMENT_WORKSPACES.find((candidate) => candidate.workspaceId === response.value.workspaceId);
      navigate(workspace ? productSpaceHome(workspace.workspaceKey, "crm") : ROUTE_KEYS.WORKSPACE_SELECTION, { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell compact visualMode="onboarding" title={vi ? "Tham gia không gian làm việc" : "Join workspace"}>
      <div className="space-y-4">
        {error && <AuthNotice tone="danger">{error}</AuthNotice>}
        {!token && <AuthNotice tone="warning">{vi ? "Liên kết không hợp lệ." : "The link is invalid."}</AuthNotice>}
        {!session ? (
          <Link
            to={`${ROUTE_KEYS.LOGIN}?redirect=${encodeURIComponent(`${ROUTE_KEYS.INVITATION_ACCEPTANCE}?token=${token}`)}`}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5"
          >
            {vi ? "Đăng nhập để tiếp tục" : "Sign in to continue"}
          </Link>
        ) : (
          <AuthPrimaryButton type="button" disabled={!token} onClick={handleAccept} loading={isSubmitting} loadingLabel={vi ? "Đang chấp nhận…" : "Accepting…"}>
            {vi ? "Chấp nhận lời mời" : "Accept invitation"}
          </AuthPrimaryButton>
        )}
      </div>
    </AuthShell>
  );
};

export default InvitationAcceptancePage;
