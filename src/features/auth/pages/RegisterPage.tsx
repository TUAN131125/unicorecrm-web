import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { registerAccount } from "@/platform/identity-auth";
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
import { emailVerificationNavigationState } from "../routing/emailVerificationContext";

function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export const RegisterPage: React.FC = () => {
  const { locale, t } = useI18n();
  const vi = locale === "vi";
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const strength = useMemo(() => passwordScore(password), [password]);

  const strengthLabel = [
    vi ? "Chưa nhập" : "Empty",
    vi ? "Cơ bản" : "Basic",
    vi ? "Khá" : "Fair",
    vi ? "Tốt" : "Good",
    vi ? "Mạnh" : "Strong",
  ][strength];

  const handleExternalAuth = (provider: ExternalAuthProvider) => {
    setError(null);
    const external = startExternalAuth(provider);
    if (!external.ok) {
      setError(vi ? "Phương thức đăng ký này chưa được bật." : "This sign-up method is not enabled yet.");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!displayName.trim() || !email.trim()) {
      setError(vi ? "Nhập họ tên và email để tiếp tục." : "Enter your name and email to continue.");
      return;
    }
    if (!acceptedTerms) {
      setError(vi ? "Bạn cần đồng ý với điều khoản sử dụng." : "You must accept the terms of use.");
      return;
    }
    if (password.length < 8) {
      setError(vi ? "Mật khẩu cần ít nhất 8 ký tự." : "Password must contain at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await registerAccount({ displayName: displayName.trim(), email: email.trim(), password });
      if (response.ok === false) {
        setError(describeRegistrationFailure(response.code, vi));
        return;
      }
      // Registration never signs anyone in and never provisions a workspace. What happens
      // next is decided by the status the server reported, which is read rather than assumed.
      const account = response.value;
      if (account.status === "PENDING_VERIFICATION") {
        // Awaiting a code. The address travels in the history entry rather than in browser
        // storage, so the next screen knows who it is verifying without treating a stored
        // value as authority.
        navigate(ROUTE_KEYS.VERIFY_EMAIL, { state: emailVerificationNavigationState(account.email) });
        return;
      }
      // Any other status has nothing to verify here, and this screen must not decide what an
      // account in that state may do. Sign-in already owns that judgement - it routes a
      // suspended account and an unverified one to their own screens - so the visitor is sent
      // there with the address carried, and the server keeps the last word.
      navigate(ROUTE_KEYS.LOGIN, { state: emailVerificationNavigationState(account.email) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      visualMode="onboarding"
      title={vi ? "Tạo tài khoản" : "Create account"}
      footer={
        <span>
          {vi ? "Đã có tài khoản?" : "Already have an account?"}{" "}
          <Link className="font-semibold text-indigo-600 transition hover:text-indigo-800 hover:underline" to={ROUTE_KEYS.LOGIN}>
            {vi ? "Đăng nhập" : "Sign in"}
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
            label={vi ? "Họ và tên" : "Full name"}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            icon={<UserRound size={16} />}
            placeholder={vi ? "Nguyễn Minh Anh" : "Alex Morgan"}
            autoComplete="name"
            required
          />
          <AuthField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            icon={<Mail size={16} />}
            placeholder="name@company.com"
            autoComplete="email"
            required
          />
          <div className="space-y-2">
            <AuthField
              label={vi ? "Mật khẩu" : "Password"}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              icon={<Lock size={16} />}
              placeholder={vi ? "Ít nhất 8 ký tự" : "At least 8 characters"}
              autoComplete="new-password"
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
              required
            />
            <div className="flex items-center gap-2">
              <div className="grid flex-1 grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((level) => (
                  <span
                    key={level}
                    className={`h-1.5 rounded-full transition ${strength >= level ? (strength >= 4 ? "bg-emerald-500" : "bg-indigo-500") : "bg-slate-200"}`}
                  />
                ))}
              </div>
              <span className="min-w-14 text-right text-[10px] font-medium text-slate-500">{strengthLabel}</span>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 py-1 text-xs font-medium leading-5 text-slate-600">
            <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600" />
            <span>{vi ? "Tôi đồng ý với điều khoản sử dụng." : "I agree to the terms of use."}</span>
          </label>

          <AuthPrimaryButton type="submit" loading={isSubmitting} loadingLabel={vi ? "Đang tạo tài khoản…" : "Creating account…"}>{vi ? "Tạo tài khoản" : "Create account"}</AuthPrimaryButton>
        </form>
      </div>
    </AuthShell>
  );
};

/**
 * Registration reports only what the contract distinguishes. Everything else is one
 * server-side failure, described as such rather than guessed at.
 */
function describeRegistrationFailure(code: string, vi: boolean): string {
  switch (code) {
    case "ACCOUNT_ALREADY_EXISTS":
      return vi
        ? "Địa chỉ email này đã được sử dụng. Hãy đăng nhập hoặc dùng email khác."
        : "That email address is already in use. Sign in or use another address.";
    case "PASSWORD_POLICY_VIOLATION":
      return vi ? "Mật khẩu chưa đáp ứng yêu cầu bảo mật." : "The password does not meet the security requirements.";
    case "VALIDATION_FAILED":
      return vi ? "Thông tin đăng ký chưa hợp lệ." : "The registration details are not valid.";
    case "EMAIL_DELIVERY_UNAVAILABLE":
      return vi
        ? "Dịch vụ gửi email tạm thời không khả dụng nên chưa thể tạo tài khoản. Hãy thử lại sau."
        : "Email delivery is temporarily unavailable, so the account cannot be created yet. Please try again later.";
    case "RATE_LIMITED":
      return vi ? "Quá nhiều yêu cầu. Vui lòng thử lại sau." : "Too many requests. Please try again later.";
    case "SERVICE_UNAVAILABLE":
      return vi
        ? "Không kết nối được máy chủ UnicoreCRM. Kiểm tra kết nối rồi thử lại."
        : "Cannot reach the UnicoreCRM server. Check the connection, then try again.";
    default:
      return vi ? "Không thể tạo tài khoản lúc này." : "The account could not be created right now.";
  }
}

export default RegisterPage;
