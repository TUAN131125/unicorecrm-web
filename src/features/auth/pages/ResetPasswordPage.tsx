import React, { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { completeAccountPasswordReset } from "@/platform/identity-auth";
import { AuthField, AuthNotice, AuthPrimaryButton, AuthShell } from "../components";

function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export const ResetPasswordPage: React.FC = () => {
  const { locale, t } = useI18n();
  const vi = locale === "vi";
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const strength = useMemo(() => passwordScore(password), [password]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError(vi ? "Liên kết không hợp lệ." : "This link is invalid.");
      return;
    }
    if (password.length < 8) {
      setError(vi ? "Mật khẩu cần ít nhất 8 ký tự." : "Password must contain at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError(vi ? "Hai mật khẩu không khớp." : "Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await completeAccountPasswordReset(token, password);
      if (response.ok === false) {
        setError(response.code === "TOKEN_EXPIRED" ? (vi ? "Liên kết đã hết hạn." : "This link has expired.") : (vi ? "Liên kết không hợp lệ." : "This link is invalid."));
        return;
      }
      setCompleted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      compact
      visualMode="neutral"
      title={completed ? (vi ? "Mật khẩu đã cập nhật" : "Password updated") : (vi ? "Đặt mật khẩu mới" : "Set a new password")}
      footer={!completed ? <Link className="font-semibold text-indigo-600 hover:underline" to={ROUTE_KEYS.LOGIN}>{vi ? "Quay lại đăng nhập" : "Back to sign in"}</Link> : undefined}
    >
      {completed ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <CheckCircle2 size={30} />
          </div>
          <Link to={ROUTE_KEYS.LOGIN} className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5">
            {vi ? "Đăng nhập" : "Sign in"}
          </Link>
        </div>
      ) : (
        <form data-auth-form="true" className="space-y-4" onSubmit={handleSubmit}>
          {error && <AuthNotice tone="danger">{error}</AuthNotice>}
          <div className="space-y-2">
            <AuthField
              label={vi ? "Mật khẩu mới" : "New password"}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              icon={<Lock size={16} />}
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
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((level) => (
                <span key={level} className={`h-1.5 rounded-full transition ${strength >= level ? (strength >= 4 ? "bg-emerald-500" : "bg-indigo-500") : "bg-slate-200"}`} />
              ))}
            </div>
          </div>
          <AuthField
            label={vi ? "Xác nhận mật khẩu" : "Confirm password"}
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            icon={<Lock size={16} />}
            autoComplete="new-password"
            required
          />
          <AuthPrimaryButton type="submit" loading={isSubmitting} loadingLabel={vi ? "Đang cập nhật…" : "Updating…"}>{vi ? "Cập nhật mật khẩu" : "Update password"}</AuthPrimaryButton>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPasswordPage;
