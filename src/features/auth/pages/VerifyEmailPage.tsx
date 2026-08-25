import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import {
  developmentEmailVerificationCode,
  requestAccountEmailVerification,
  verifyAccountEmail,
} from "@/platform/identity-auth";
import { AuthCodeField, AuthNotice, AuthPrimaryButton, AuthShell } from "../components";
import {
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
  emailVerificationNavigationState,
  resolveEmailVerificationSubject,
} from "../routing/emailVerificationContext";

const CODE_LENGTH = 6;

type Feedback = { tone: "danger" | "warning" | "info" | "success"; message: string };

export const VerifyEmailPage: React.FC = () => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const navigate = useNavigate();
  const location = useLocation();
  const email = useMemo(() => resolveEmailVerificationSubject(location.state), [location.state]);

  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS);
  const sampleCode = useMemo(() => developmentEmailVerificationCode(), []);

  // The success screen is a beat of confirmation, not a destination. Scheduling the handover
  // in an effect means an unmount - the visitor taking the sign-in link themselves - cancels it
  // rather than navigating out from under a screen that is already gone.
  useEffect(() => {
    if (!verifiedEmail) return;
    const timer = window.setTimeout(() => {
      navigate(ROUTE_KEYS.LOGIN, { replace: true, state: emailVerificationNavigationState(verifiedEmail) });
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [verifiedEmail, navigate]);

  // A code is delivered the moment an account is created, so the screen opens inside the
  // same waiting period a resend would start. Counting down from the first render keeps the
  // affordance honest instead of inviting a request the server will decline in silence.
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => setCooldownSeconds((value) => value - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const acceptCode = useCallback((value: string) => {
    setCode(value.replace(/\D/gu, "").slice(0, CODE_LENGTH));
    setFeedback(null);
  }, []);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) return;
    const submitted = code.trim();
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`, "u").test(submitted)) {
      setFeedback({
        tone: "danger",
        message: vi ? "Nhập đúng 6 chữ số của mã xác minh." : "Enter all six digits of the verification code.",
      });
      return;
    }

    setFeedback(null);
    setIsVerifying(true);
    const result = await verifyAccountEmail({ email, code: submitted });
    setIsVerifying(false);

    if (result.ok === false) {
      setFeedback({ tone: result.code === "TOKEN_EXPIRED" ? "warning" : "danger", message: describeVerificationFailure(result.code, vi) });
      return;
    }

    // The code is spent. Nothing about it stays in component state, and the address moves
    // on through navigation state so sign-in can open on the right account.
    setCode("");
    setVerifiedEmail(result.value.email);
    setFeedback({ tone: "success", message: vi ? "Email của bạn đã được xác minh." : "Your email address is verified." });
  };

  const handleResend = async () => {
    if (!email || cooldownSeconds > 0) return;
    setFeedback(null);
    setIsResending(true);
    const result = await requestAccountEmailVerification(email);
    setIsResending(false);

    if (result.ok === false) {
      setFeedback({ tone: "danger", message: describeResendFailure(result.code, vi) });
      return;
    }

    // Acceptance is uniform on purpose: it says the request was taken, never that an
    // account exists or that a message went out. The copy says exactly that much.
    setCode("");
    setCooldownSeconds(EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS);
    setFeedback({
      tone: "info",
      message: vi
        ? "Nếu địa chỉ này vẫn cần xác minh, một mã mới sẽ được gửi."
        : "If verification is still required, a new code will be sent.",
    });
  };

  if (!email) {
    return (
      <AuthShell
        compact
        visualMode="onboarding"
        title={vi ? "Xác minh email" : "Verify email"}
        footer={<Link className="font-semibold text-indigo-600 hover:underline" to={ROUTE_KEYS.LOGIN}>{vi ? "Quay lại đăng nhập" : "Back to sign in"}</Link>}
      >
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <MailCheck size={30} />
          </div>
          <AuthNotice tone="warning">
            {vi
              ? "Chưa xác định được địa chỉ email cần xác minh. Hãy tạo tài khoản hoặc đăng nhập để tiếp tục."
              : "There is no email address to verify here. Create an account or sign in to continue."}
          </AuthNotice>
          <Link
            to={ROUTE_KEYS.REGISTER}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5"
          >
            {vi ? "Tạo tài khoản" : "Create account"}
          </Link>
          <Link
            to={ROUTE_KEYS.LOGIN}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            {vi ? "Đăng nhập" : "Sign in"}
          </Link>
        </div>
      </AuthShell>
    );
  }

  const busy = isVerifying || isResending;

  return (
    <AuthShell
      compact
      visualMode="onboarding"
      title={verifiedEmail ? (vi ? "Email đã xác minh" : "Email verified") : (vi ? "Xác minh email" : "Verify email")}
      footer={<Link className="font-semibold text-indigo-600 hover:underline" to={ROUTE_KEYS.LOGIN}>{vi ? "Quay lại đăng nhập" : "Back to sign in"}</Link>}
    >
      <div className="space-y-5">
        <div className="space-y-3 text-center">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] ring-1 ${verifiedEmail ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : "bg-indigo-50 text-indigo-600 ring-indigo-100"}`}>
            {verifiedEmail ? <CheckCircle2 size={30} /> : <MailCheck size={30} />}
          </div>
          <p className="text-xs font-medium leading-5 text-slate-500">
            {verifiedEmail
              ? (vi ? "Địa chỉ đã được xác minh" : "This address is now verified")
              : (vi ? "Chúng tôi đã gửi mã gồm 6 chữ số tới" : "We sent a six-digit code to")}
          </p>
          <p data-verify-email-subject="true" className="crm-text-wrap text-sm font-semibold text-slate-800">{email}</p>
        </div>

        {feedback && <AuthNotice tone={feedback.tone}>{feedback.message}</AuthNotice>}

        {!verifiedEmail && (
          <>
            <form data-auth-form="true" className="space-y-4" onSubmit={handleVerify}>
              <AuthCodeField
                label={vi ? "Mã xác minh" : "Verification code"}
                aria-label={vi ? "Mã xác minh" : "Verification code"}
                name="one-time-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(event) => acceptCode(event.target.value)}
                onPaste={(event) => {
                  event.preventDefault();
                  acceptCode(event.clipboardData.getData("text"));
                }}
                placeholder="••••••"
                disabled={busy}
                autoFocus
                required
              />

              {sampleCode && (
                <button
                  type="button"
                  onClick={() => acceptCode(sampleCode)}
                  disabled={busy}
                  className="mx-auto block rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {vi ? "Dùng mã mẫu" : "Use the sample code"}
                </button>
              )}

              <AuthPrimaryButton
                type="submit"
                loading={isVerifying}
                disabled={isResending}
                loadingLabel={vi ? "Đang xác minh…" : "Verifying…"}
              >
                {vi ? "Xác minh" : "Verify"}
              </AuthPrimaryButton>
            </form>

            <div className="space-y-2 text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={busy || cooldownSeconds > 0}
                aria-disabled={busy || cooldownSeconds > 0}
                className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
              >
                {isResending
                  ? (vi ? "Đang gửi lại…" : "Sending a new code…")
                  : (vi ? "Gửi lại mã" : "Resend code")}
              </button>
              <p aria-live="polite" className="text-[11px] font-medium text-slate-500">
                {cooldownSeconds > 0
                  ? (vi ? `Có thể gửi lại sau ${cooldownSeconds} giây.` : `You can request a new code in ${cooldownSeconds}s.`)
                  : (vi ? "Bạn có thể yêu cầu mã mới." : "You can request a new code.")}
              </p>
            </div>
          </>
        )}

        {verifiedEmail && (
          <Link
            to={ROUTE_KEYS.LOGIN}
            state={emailVerificationNavigationState(verifiedEmail)}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5"
          >
            {vi ? "Đăng nhập" : "Sign in"}
          </Link>
        )}
      </div>
    </AuthShell>
  );
};

/**
 * Only the contract-declared answers describe the submitted code. A transport failure or a
 * server fault is a different outcome and is reported as one, so a visitor is never told a
 * correct code was wrong because the service could not be reached.
 */
function describeVerificationFailure(code: string, vi: boolean): string {
  switch (code) {
    case "TOKEN_INVALID":
      return vi ? "Mã xác minh không hợp lệ." : "The verification code is invalid.";
    case "TOKEN_EXPIRED":
      return vi ? "Mã xác minh đã hết hạn. Hãy yêu cầu mã mới." : "The verification code has expired. Request a new code.";
    case "RATE_LIMITED":
      return vi
        ? "Đã thử quá nhiều lần với mã này. Hãy yêu cầu mã mới rồi thử lại."
        : "Too many attempts were made with this code. Request a new code, then try again.";
    case "VALIDATION_FAILED":
      return vi ? "Địa chỉ email hoặc mã xác minh không hợp lệ." : "The email address or verification code is not valid.";
    case "EMAIL_DELIVERY_UNAVAILABLE":
      return vi ? "Dịch vụ gửi email tạm thời không khả dụng." : "Email delivery is temporarily unavailable.";
    case "SERVICE_UNAVAILABLE":
      return vi
        ? "Không kết nối được máy chủ UnicoreCRM. Kiểm tra kết nối rồi thử lại."
        : "Cannot reach the UnicoreCRM server. Check the connection, then try again.";
    case "AUTH_ADAPTER_UNAVAILABLE":
      return vi ? "Xác minh email hiện chưa khả dụng." : "Email verification is currently unavailable.";
    default:
      return vi
        ? "Xác minh thất bại do lỗi máy chủ. Vui lòng thử lại."
        : "Verification failed because of a server error. Please try again.";
  }
}

function describeResendFailure(code: string, vi: boolean): string {
  switch (code) {
    case "EMAIL_DELIVERY_UNAVAILABLE":
      return vi
        ? "Dịch vụ gửi email tạm thời không khả dụng. Hãy thử lại sau."
        : "Email delivery is temporarily unavailable. Please try again later.";
    case "RATE_LIMITED":
      return vi ? "Quá nhiều yêu cầu. Vui lòng thử lại sau." : "Too many requests. Please try again later.";
    case "VALIDATION_FAILED":
      return vi ? "Địa chỉ email không hợp lệ." : "That email address is not valid.";
    case "SERVICE_UNAVAILABLE":
      return vi
        ? "Không kết nối được máy chủ UnicoreCRM. Kiểm tra kết nối rồi thử lại."
        : "Cannot reach the UnicoreCRM server. Check the connection, then try again.";
    case "AUTH_ADAPTER_UNAVAILABLE":
      return vi ? "Gửi lại mã hiện chưa khả dụng." : "Requesting a new code is currently unavailable.";
    default:
      return vi
        ? "Không gửi lại được mã do lỗi máy chủ. Vui lòng thử lại."
        : "The code could not be requested because of a server error. Please try again.";
  }
}

export default VerifyEmailPage;
