import React, { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { productSpaceHome } from "@/platform/navigation";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { acceptWorkspaceInvitation, getAuthSessionSnapshot, isConnectedAuthRuntime, isDevelopmentAuthAdapter } from "@/platform/identity-auth";
import { DEVELOPMENT_WORKSPACES } from "@/platform/workspace-membership";
import { enterWorkspace, isConnectedWorkspaceRuntime, loadWorkspaceMemberships } from "@/platform/workspace-context";
import { AuthNotice, AuthPrimaryButton, AuthShell } from "../components";
import { withRedirectQuery } from "../routing/postLoginRedirect";

export const InvitationAcceptancePage: React.FC = () => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const session = getAuthSessionSnapshot();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const invitationPath = `${ROUTE_KEYS.INVITATION_ACCEPTANCE}?${new URLSearchParams({ token }).toString()}`;

  const handleAccept = async () => {
    if (!token || !session || submitting.current) return;
    submitting.current = true;
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await acceptWorkspaceInvitation(token);
      if (response.ok === false) {
        setError(describeInvitationFailure(response.code, vi));
        return;
      }
      if (isConnectedAuthRuntime()) {
        if (!isConnectedWorkspaceRuntime()) {
          setError(vi ? "Chưa thể xác minh quyền truy cập không gian làm việc. Vui lòng thử lại." : "Workspace access could not be verified. Please try again.");
          return;
        }
        const memberships = await loadWorkspaceMemberships();
        const membership = memberships.find((candidate) => candidate.workspaceId === response.value.workspaceId && candidate.status === "active");
        if (!membership) {
          setError(vi ? "Chưa thể xác minh quyền truy cập không gian làm việc. Vui lòng thử lại." : "Workspace access could not be verified. Please try again.");
          return;
        }
        const context = await enterWorkspace(membership.workspaceId);
        navigate(productSpaceHome(context.workspace.workspaceKey, "crm"), { replace: true });
        return;
      }
      const workspace = isDevelopmentAuthAdapter() ? DEVELOPMENT_WORKSPACES.find((candidate) => candidate.workspaceId === response.value.workspaceId) : undefined;
      if (workspace) navigate(productSpaceHome(workspace.workspaceKey, "crm"), { replace: true });
      else setError(vi ? "Không thể mở không gian làm việc này." : "This workspace could not be opened.");
    } catch {
      setError(vi ? "Không thể kết nối hoặc mở không gian làm việc. Vui lòng thử lại." : "Unable to connect or open the workspace. Please try again.");
    } finally {
      submitting.current = false;
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
            to={withRedirectQuery(ROUTE_KEYS.LOGIN, invitationPath)}
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

function describeInvitationFailure(code: string, vi: boolean): string {
  switch (code) {
    case "INVITATION_INVALID":
    case "TOKEN_INVALID":
      return vi ? "Lời mời không hợp lệ hoặc đã bị thu hồi." : "The invitation is invalid or has been revoked.";
    case "TOKEN_EXPIRED":
      return vi ? "Lời mời đã hết hạn. Hãy yêu cầu lời mời mới." : "The invitation has expired. Request a new invitation.";
    case "EMAIL_NOT_VERIFIED":
      return vi ? "Xác minh email của bạn trước khi chấp nhận lời mời." : "Verify your email before accepting the invitation.";
    case "ACCESS_DENIED":
      return vi ? "Lời mời này không dành cho tài khoản đang đăng nhập." : "This invitation is not available to the signed-in account.";
    case "AUTHENTICATION_REQUIRED":
    case "SESSION_EXPIRED":
    case "SESSION_REVOKED":
      return vi ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại." : "Your session has ended. Sign in again.";
    case "RATE_LIMITED":
      return vi ? "Quá nhiều yêu cầu. Vui lòng thử lại sau." : "Too many requests. Please try again later.";
    default:
      return vi ? "Chưa thể chấp nhận lời mời. Vui lòng thử lại sau." : "The invitation could not be accepted. Please try again later.";
  }
}
