import React, { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { isDevelopmentAuthAdapter, requestAccountPasswordReset } from "@/platform/identity-auth";
import { AuthField, AuthPrimaryButton, AuthShell } from "../components";

export const ForgotPasswordPage: React.FC = () => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const [email, setEmail] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await requestAccountPasswordReset(email.trim());
      setSubmitted(true);
      if (response.ok) setRequestId(response.value.requestId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      compact
      visualMode="neutral"
      title={submitted ? (vi ? "Kiểm tra email" : "Check your email") : (vi ? "Quên mật khẩu" : "Forgot password")}
      footer={<Link className="font-semibold text-indigo-600 hover:underline" to={ROUTE_KEYS.LOGIN}>{vi ? "Quay lại đăng nhập" : "Back to sign in"}</Link>}
    >
      {submitted ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <CheckCircle2 size={30} />
          </div>
          <div className="text-sm font-medium text-slate-600">{email.trim()}</div>
          {isDevelopmentAuthAdapter() && requestId && (
            <Link
              to={`${ROUTE_KEYS.RESET_PASSWORD}?token=${encodeURIComponent(requestId)}`}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5"
            >
              {vi ? "Đặt lại mật khẩu" : "Reset password"}
            </Link>
          )}
        </div>
      ) : (
        <form data-auth-form="true" className="space-y-4" onSubmit={handleSubmit}>
          <AuthField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            icon={<Mail size={16} />}
            required
          />
          <AuthPrimaryButton type="submit" loading={isSubmitting} loadingLabel={vi ? "Đang gửi…" : "Sending…"}>{vi ? "Tiếp tục" : "Continue"}</AuthPrimaryButton>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPasswordPage;
