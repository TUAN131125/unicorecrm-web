import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Eye, EyeOff, Lock, Mail, UserRoundCheck } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { productSpaceHome } from "@/platform/navigation";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import {
  isConnectedAuthRuntime,
  isDevelopmentAuthAdapter,
  listDevelopmentAccounts,
  authenticateUser,
} from "@/platform/identity-auth";
import { listWorkspaceMembershipsForAccount } from "@/platform/workspace-membership";
import {
  AuthDivider,
  AuthField,
  AuthNotice,
  AuthPrimaryButton,
  AuthProviderButtons,
  AuthShell,
  type ExternalAuthProvider,
} from "../components";
import { startExternalAuth } from "../routing/externalAuthRedirect";
import { resolveSafePostLoginRedirect } from "../routing/postLoginRedirect";
import { emailVerificationNavigationState, resolveEmailVerificationSubject } from "../routing/emailVerificationContext";

export const LoginPage: React.FC = () => {
  const { locale, t } = useI18n();
  const vi = locale === "vi";
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  const redirect = resolveSafePostLoginRedirect(searchParams.get("redirect"));
  const developmentAccounts = useMemo(() => listDevelopmentAccounts(), []);
  const showDevelopmentAccess = isDevelopmentAuthAdapter() && developmentAccounts.length > 0;

  // A just-verified address arrives in the history entry and takes precedence over the
  // remembered one, so finishing verification opens sign-in on the account that was verified.
  const [email, setEmail] = useState(() => {
    const verified = resolveEmailVerificationSubject(location.state);
    if (verified) return verified;
    return typeof window === "undefined" ? "" : window.localStorage.getItem("unicore_last_login_email") ?? "";
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [developmentOpen, setDevelopmentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvePostLoginDestination = (accountId: string) => {
    if (isConnectedAuthRuntime()) return ROUTE_KEYS.WORKSPACE_SELECTION;
    if (redirect) return redirect;
    const memberships = listWorkspaceMembershipsForAccount(accountId).filter((membership) => membership.status === "active");
    if (memberships.length === 1) return productSpaceHome(memberships[0].workspaceKey, "crm");
    if (memberships.length > 1) return ROUTE_KEYS.WORKSPACE_SELECTION;
    return `${ROUTE_KEYS.ACCESS_DENIED}?reason=no-membership`;
  };

  const handleExternalAuth = (provider: ExternalAuthProvider) => {
    setError(null);
    const result = startExternalAuth(provider, redirect);
    if (!result.ok) {
      setError(vi ? "Phương thức đăng nhập này chưa được bật." : "This sign-in method is not enabled yet.");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(vi ? "Nhập email và mật khẩu để tiếp tục." : "Enter your email and password to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authenticateUser({ email: email.trim(), password, deviceLabel: "Browser" });
      if (result.ok === false) {
        if (result.code === "ACCOUNT_SUSPENDED") {
          navigate(`${ROUTE_KEYS.ACCOUNT_SUSPENDED}?email=${encodeURIComponent(email.trim())}`, { replace: true });
          return;
        }
        if (result.code === "MFA_REQUIRED" && result.challengeId) {
          const params = new URLSearchParams({ challenge: result.challengeId });
          if (redirect) params.set("redirect", redirect);
          navigate(`${ROUTE_KEYS.MFA_VERIFICATION}?${params.toString()}`, { replace: true });
          return;
        }
        // A refused sign-in that names an unverified address is not a rejected credential.
        // It is a route into verification, and it carries the address it was refused for.
        if (result.code === "EMAIL_NOT_VERIFIED") {
          navigate(ROUTE_KEYS.VERIFY_EMAIL, { state: emailVerificationNavigationState(email.trim()) });
          return;
        }
        setError(describeSignInFailure(result.code, vi));
        return;
      }

      if (rememberAccount) window.localStorage.setItem("unicore_last_login_email", result.value.principal.email);
      else window.localStorage.removeItem("unicore_last_login_email");
      navigate(resolvePostLoginDestination(result.value.principal.accountId), { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectDevelopmentAccount = (account: (typeof developmentAccounts)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
    setDevelopmentOpen(false);
  };

  return (
    <AuthShell
      visualMode="access"
      title={vi ? "Đăng nhập" : "Sign in"}
      footer={
        <span>
          {vi ? "Chưa có tài khoản?" : "New to UnicoreCRM?"}{" "}
          <Link className="font-semibold text-indigo-600 transition hover:text-indigo-800 hover:underline" to={ROUTE_KEYS.REGISTER}>
            {vi ? "Tạo tài khoản" : "Create an account"}
          </Link>
        </span>
      }
    >
      <div className="space-y-5">
        <AuthProviderButtons onSelect={handleExternalAuth} disabled={isSubmitting} />
        <AuthDivider label={vi ? "hoặc" : "or"} />

        <form data-auth-form="true" className="space-y-4" onSubmit={handleSubmit}>
          <AnimatePresence initial={false}>
            {error && (
              <motion.div initial={reduceMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                <AuthNotice tone="danger">{error}</AuthNotice>
              </motion.div>
            )}
          </AnimatePresence>

          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            icon={<Mail size={16} />}
            disabled={isSubmitting}
            required
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700">
              <span>{vi ? "Mật khẩu" : "Password"}</span>
              <Link className="text-indigo-600 transition hover:text-indigo-800 hover:underline" to={ROUTE_KEYS.FORGOT_PASSWORD}>
                {vi ? "Quên mật khẩu?" : "Forgot password?"}
              </Link>
            </div>
            <AuthField
              label=""
              aria-label={vi ? "Mật khẩu" : "Password"}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              icon={<Lock size={16} />}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? t("common.hidePassword") : t("common.showPassword")}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              disabled={isSubmitting}
              required
            />
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-xs font-medium text-slate-600">
            <span>{vi ? "Ghi nhớ tài khoản" : "Remember account"}</span>
            <span className="relative inline-flex">
              <input
                type="checkbox"
                checked={rememberAccount}
                onChange={(event) => setRememberAccount(event.target.checked)}
                className="peer sr-only"
              />
              <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-indigo-600 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-100" />
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
            </span>
          </label>

          <AuthPrimaryButton type="submit" loading={isSubmitting} loadingLabel={vi ? "Đang đăng nhập…" : "Signing in…"}>
            {vi ? "Đăng nhập" : "Sign in"}
          </AuthPrimaryButton>
        </form>

        {showDevelopmentAccess && (
          <div className="border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setDevelopmentOpen((value) => !value)}
              aria-expanded={developmentOpen}
              className="flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              <span className="flex items-center gap-2">
                <UserRoundCheck size={15} />
                {vi ? "Dùng tài khoản mẫu" : "Use a sample account"}
              </span>
              <ChevronDown size={15} className={`transition ${developmentOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence initial={false}>
              {developmentOpen && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-2 pt-2 sm:grid-cols-2">
                    {developmentAccounts.map((account) => (
                      <button
                        key={account.accountId}
                        type="button"
                        onClick={() => selectDevelopmentAccount(account)}
                        className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"
                      >
                        <div className="crm-text-wrap text-xs font-medium text-slate-800">{account.displayName}</div>
                        <div className="mt-1 crm-text-wrap text-[10px] text-slate-500">{account.roleLabel}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AuthShell>
  );
};

/**
 * Only a contract-declared credential rejection may be shown as a wrong password.
 * A connection failure, a timeout or a server fault is a different outcome and is
 * reported as one.
 */
function describeSignInFailure(code: string, vi: boolean): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return vi ? "Email hoặc mật khẩu không đúng." : "Email or password is incorrect.";
    case "ACCESS_DENIED":
    case "AUTHENTICATION_REQUIRED":
      return vi
        ? "Tài khoản này không được phép đăng nhập."
        : "This account is not permitted to sign in.";
    case "RATE_LIMITED":
      return vi
        ? "Quá nhiều lần thử. Vui lòng thử lại sau."
        : "Too many attempts. Please try again later.";
    case "SERVICE_UNAVAILABLE":
      return vi
        ? "Không kết nối được máy chủ UnicoreCRM. Kiểm tra ApiHost rồi thử lại."
        : "Cannot reach the UnicoreCRM server. Check that the ApiHost is running, then try again.";
    case "AUTH_ADAPTER_UNAVAILABLE":
      return vi ? "Đăng nhập hiện chưa khả dụng." : "Sign-in is currently unavailable.";
    default:
      return vi
        ? "Đăng nhập thất bại do lỗi máy chủ. Vui lòng thử lại."
        : "Sign-in failed because of a server error. Please try again.";
  }
}

export default LoginPage;
