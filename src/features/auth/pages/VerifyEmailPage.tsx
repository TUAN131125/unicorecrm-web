import React, { useState } from "react";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { verifyAccountEmail } from "@/platform/identity-auth";
import { AuthNotice, AuthPrimaryButton, AuthShell } from "../components";

export const VerifyEmailPage: React.FC = () => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVerify = async () => {
    setIsSubmitting(true);
    try {
      const response = await verifyAccountEmail(token);
      if (response.ok === false) {
        setStatus("error");
        setMessage(vi ? "Liên kết không hợp lệ hoặc đã hết hạn." : "The link is invalid or expired.");
        return;
      }
      setStatus("success");
      setMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      compact
      visualMode="onboarding"
      title={status === "success" ? (vi ? "Email đã xác minh" : "Email verified") : (vi ? "Xác minh email" : "Verify email")}
      footer={<Link className="font-semibold text-indigo-600 hover:underline" to={ROUTE_KEYS.LOGIN}>{vi ? "Quay lại đăng nhập" : "Back to sign in"}</Link>}
    >
      <div className="space-y-5 text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] ring-1 ${status === "success" ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : "bg-indigo-50 text-indigo-600 ring-indigo-100"}`}>
          {status === "success" ? <CheckCircle2 size={30} /> : <MailCheck size={30} />}
        </div>
        {email && status !== "success" ? <div className="text-sm font-medium text-slate-600">{email}</div> : null}
        {status === "error" && <AuthNotice tone="danger">{message}</AuthNotice>}
        {status === "idle" && token && <AuthPrimaryButton type="button" onClick={handleVerify} loading={isSubmitting} loadingLabel={vi ? "Đang xác minh…" : "Verifying…"}>{vi ? "Xác minh" : "Verify"}</AuthPrimaryButton>}
        {status === "idle" && !token && <AuthNotice tone="warning">{vi ? "Không tìm thấy mã xác minh." : "No verification code was found."}</AuthNotice>}
        {status === "success" && (
          <Link to={ROUTE_KEYS.LOGIN} className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5">
            {vi ? "Đăng nhập" : "Sign in"}
          </Link>
        )}
      </div>
    </AuthShell>
  );
};

export default VerifyEmailPage;
