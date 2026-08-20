import React from "react";
import { Clock3, LockKeyhole, UserRoundX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ROUTE_KEYS } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { AuthShell } from "../components";
import { resolveSafePostLoginRedirect, withRedirectQuery } from "../routing/postLoginRedirect";

interface StatusPageProps {
  kind: "session" | "denied" | "suspended";
}

const icons = {
  session: Clock3,
  denied: LockKeyhole,
  suspended: UserRoundX,
};

const StatusPage: React.FC<StatusPageProps> = ({ kind }) => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const [searchParams] = useSearchParams();
  const redirect = resolveSafePostLoginRedirect(searchParams.get("redirect"));
  const Icon = icons[kind];

  const content = {
    session: {
      title: vi ? "Phiên đã hết hạn" : "Session expired",
      action: vi ? "Đăng nhập lại" : "Sign in again",
    },
    denied: {
      title: vi ? "Không thể mở nội dung này" : "This content is unavailable",
      action: vi ? "Quay lại đăng nhập" : "Back to sign in",
    },
    suspended: {
      title: vi ? "Tài khoản đang tạm ngưng" : "Account suspended",
      action: vi ? "Dùng tài khoản khác" : "Use another account",
    },
  }[kind];

  return (
    <AuthShell compact visualMode="neutral" title={content.title}>
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <Icon size={28} />
        </div>
        <Link
          to={kind === "session" && redirect ? withRedirectQuery(ROUTE_KEYS.LOGIN, redirect) : ROUTE_KEYS.LOGIN}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70 transition hover:-translate-y-0.5"
        >
          {content.action}
        </Link>
      </div>
    </AuthShell>
  );
};

export const SessionExpiredPage = () => <StatusPage kind="session" />;
export const AccessDeniedPage = () => <StatusPage kind="denied" />;
export const AccountSuspendedPage = () => <StatusPage kind="suspended" />;
