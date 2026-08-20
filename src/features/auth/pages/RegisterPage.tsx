import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { isDevelopmentAuthAdapter, registerAccount } from "@/platform/identity-auth";
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
  const reduceMotion = useReducedMotion();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [result, setResult] = useState<{ accountId: string; email: string } | null>(null);
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
        setError(vi ? "Không thể tạo tài khoản lúc này." : "The account could not be created right now.");
        return;
      }
      setResult({ accountId: response.value.accountId, email: response.value.email });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      visualMode="onboarding"
      title={result ? (vi ? "Kiểm tra email" : "Check your email") : (vi ? "Tạo tài khoản" : "Create account")}
      footer={
        <span>
          {vi ? "Đã có tài khoản?" : "Already have an account?"}{" "}
          <Link className="font-semibold text-indigo-600 transition hover:text-indigo-800 hover:underline" to={ROUTE_KEYS.LOGIN}>
            {vi ? "Đăng nhập" : "Sign in"}
          </Link>
        </span>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div
            key="registration-success"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <CheckCircle2 size={30} />
            </div>
            <div className="text-sm font-medium text-slate-600">{result.email}</div>
            {isDevelopmentAuthAdapter() && (
              <Link
                to={`${ROUTE_KEYS.VERIFY_EMAIL}?token=${encodeURIComponent(`dev_verify_${result.accountId}`)}`}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5"
              >
                {vi ? "Xác minh email" : "Verify email"}
              </Link>
            )}
            <Link
              to={ROUTE_KEYS.LOGIN}
              className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/40"
            >
              {vi ? "Quay lại đăng nhập" : "Back to sign in"}
            </Link>
          </motion.div>
        ) : (
          <motion.div key="registration-form" initial={false} animate={{ opacity: 1 }} className="space-y-5">
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
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
};

export default RegisterPage;
