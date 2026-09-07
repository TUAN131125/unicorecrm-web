import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { productSpaceHome } from "@/platform/navigation";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { developmentMfaCodeHint, isConnectedAuthRuntime, isDevelopmentAuthAdapter, verifyMfaAuthentication } from "@/platform/identity-auth";
import { listWorkspaceMembershipsForAccount } from "@/platform/workspace-membership";
import { AuthCodeField, AuthNotice, AuthPrimaryButton, AuthShell } from "../components";
import { resolveSafePostLoginRedirect } from "../routing/postLoginRedirect";

export const MfaVerificationPage: React.FC = () => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const challengeId = searchParams.get("challenge") ?? "";
  const redirect = resolveSafePostLoginRedirect(searchParams.get("redirect"));
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const developmentHint = useMemo(() => isDevelopmentAuthAdapter() ? developmentMfaCodeHint(challengeId) : undefined, [challengeId]);

  const resolvePostLoginDestination = (accountId: string) => {
    if (isConnectedAuthRuntime()) return ROUTE_KEYS.WORKSPACE_SELECTION;
    if (redirect) return redirect;
    const memberships = listWorkspaceMembershipsForAccount(accountId).filter((membership) => membership.status === "active");
    if (memberships.length === 1) return productSpaceHome(memberships[0].workspaceKey, "crm");
    if (memberships.length > 1) return ROUTE_KEYS.WORKSPACE_SELECTION;
    return `${ROUTE_KEYS.ACCESS_DENIED}?reason=no-membership`;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!challengeId) {
      setError(vi ? "Yêu cầu xác nhận không hợp lệ." : "The verification request is invalid.");
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError(vi ? "Nhập mã gồm 6 chữ số." : "Enter the six-digit code.");
      return;
    }
    setIsSubmitting(true);
    const result = await verifyMfaAuthentication({ challengeId, code: code.trim(), deviceLabel: "Browser" });
    setIsSubmitting(false);
    if (result.ok === false) {
      setError(result.code === "MFA_EXPIRED" || result.code === "MFA_LOCKED"
        ? (vi ? "Mã đã hết hiệu lực." : "The code is no longer valid.")
        : (vi ? "Mã xác nhận không đúng." : "The verification code is incorrect."));
      return;
    }
    navigate(resolvePostLoginDestination(result.value.principal.accountId), { replace: true });
  };

  return (
    <AuthShell
      compact
      visualMode="access"
      title={vi ? "Nhập mã xác nhận" : "Enter verification code"}
      footer={<Link className="font-semibold text-indigo-600 hover:underline" to={ROUTE_KEYS.LOGIN}>{vi ? "Quay lại đăng nhập" : "Back to sign in"}</Link>}
    >
      <form data-auth-form="true" className="space-y-4" onSubmit={handleSubmit} data-guidance-id="auth.mfa.form">
        {error && <AuthNotice tone="danger">{error}</AuthNotice>}
        <AuthCodeField
          label={vi ? "Mã xác nhận" : "Verification code"}
          aria-label={vi ? "Mã xác nhận" : "Verification code"}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          disabled={isSubmitting}
          required
        />
        {developmentHint && (
          <button type="button" onClick={() => setCode(developmentHint)} className="mx-auto block rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100">
            {vi ? `Dùng mã ${developmentHint}` : `Use ${developmentHint}`}
          </button>
        )}
        <AuthPrimaryButton type="submit" loading={isSubmitting} loadingLabel={vi ? "Đang xác nhận…" : "Verifying…"}>
          {vi ? "Xác nhận" : "Verify"}
        </AuthPrimaryButton>
      </form>
    </AuthShell>
  );
};

export default MfaVerificationPage;
